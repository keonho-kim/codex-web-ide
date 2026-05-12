#!/bin/sh
set -eu

repo="${CW_INSTALL_REPO:-keonho-kim/codex-web-ide}"
package_name="${CW_PACKAGE_NAME:-codex-web-ide}"
version="${CW_VERSION:-latest}"
bun_install_url="${CW_BUN_INSTALL_URL:-https://bun.sh/install}"

info() {
  printf '%s\n' "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

detect_proot() {
  if [ -n "${PROOT_TMP_DIR:-}" ] || [ -n "${PROOT_LOADER:-}" ] || [ -n "${PROOT_NO_SECCOMP:-}" ]; then
    return 0
  fi

  if [ -r /proc/self/environ ] && tr '\0' '\n' </proc/self/environ 2>/dev/null | grep -qi 'proot'; then
    return 0
  fi

  if [ -r /proc/1/environ ] && tr '\0' '\n' </proc/1/environ 2>/dev/null | grep -qi 'proot'; then
    return 0
  fi

  return 1
}

detect_target() {
  uname_s="$(uname -s 2>/dev/null || printf unknown)"

  if [ -n "${PREFIX:-}" ] && printf '%s' "$PREFIX" | grep -q 'com.termux'; then
    printf 'termux'
    return
  fi

  if [ "$uname_s" = "Darwin" ]; then
    printf 'macos'
    return
  fi

  if [ "$uname_s" = "Linux" ]; then
    if [ -r /proc/sys/kernel/osrelease ] && grep -qi 'microsoft\|wsl' /proc/sys/kernel/osrelease; then
      printf 'wsl'
      return
    fi

    if detect_proot; then
      printf 'proot'
      return
    fi

    printf 'linux'
    return
  fi

  printf 'unknown'
}

detect_arch() {
  case "$(uname -m 2>/dev/null || printf unknown)" in
    arm64 | aarch64) printf 'arm64' ;;
    x86_64 | amd64) printf 'x64' ;;
    *) printf 'unknown' ;;
  esac
}

print_prereq_hint() {
  target="$1"

  case "$target" in
    termux)
      info "Install prerequisites with Termux packages where available, then install Bun manually if needed."
      ;;
    macos)
      info "Install prerequisites with Homebrew or the official Bun installer."
      ;;
    wsl | proot | linux)
      info "Install prerequisites with your distro package manager, for example: sudo apt install -y curl git"
      ;;
  esac
}

ensure_curl() {
  if has_cmd curl; then
    return
  fi

  print_prereq_hint "$target"
  die "curl is required to install ${package_name}."
}

ensure_tar() {
  if has_cmd tar; then
    return
  fi

  print_prereq_hint "$target"
  die "tar is required to install ${package_name}."
}

install_bun_with_official_installer() {
  info "Bun was not found. Installing Bun from ${bun_install_url}..."
  if has_cmd bash; then
    curl -fsSL "$bun_install_url" | bash
  else
    curl -fsSL "$bun_install_url" | sh
  fi
}

ensure_bun() {
  if has_cmd bun; then
    return
  fi

  if [ "$target" = "termux" ]; then
    die "Bun is required on Termux. Install Bun first, then rerun this installer."
  fi

  install_bun_with_official_installer

  if [ -d "$HOME/.bun/bin" ]; then
    PATH="$HOME/.bun/bin:$PATH"
    export PATH
  fi

  has_cmd bun || die "Bun installation finished, but bun is still not on PATH."
}

resolve_latest_version() {
  latest_url="$(curl -fsSIL -o /dev/null -w '%{url_effective}' "https://github.com/${repo}/releases/latest")"
  latest_tag="${latest_url##*/}"

  case "$latest_tag" in
    v[0-9]*.[0-9]*.[0-9]*) printf '%s' "$latest_tag" ;;
    *) die "Could not resolve latest release tag from GitHub." ;;
  esac
}

normalize_version() {
  requested="$1"

  case "$requested" in
    latest) resolve_latest_version ;;
    v*) printf '%s' "$requested" ;;
    *) printf 'v%s' "$requested" ;;
  esac
}

resolve_global_bin_dir() {
  bin_dir="$(bun pm bin -g 2>/dev/null || true)"
  if [ -n "$bin_dir" ]; then
    printf '%s' "$bin_dir"
    return
  fi

  printf '%s/.bun/bin' "$HOME"
}

resolve_release_platform() {
  case "$target" in
    termux | proot | wsl | linux) printf 'linux' ;;
    macos) printf 'macos' ;;
    *) die "Production release archives are currently published for Linux, WSL, Termux, proot, and macOS only." ;;
  esac
}

cleanup_tmp_dir() {
  if [ -n "${tmp_dir:-}" ] && [ -d "$tmp_dir" ]; then
    rm -rf "$tmp_dir"
  fi
}

target="$(detect_target)"
arch="$(detect_arch)"

case "$target" in
  termux | macos | wsl | proot | linux) ;;
  *) die "Unsupported OS: $(uname -s 2>/dev/null || printf unknown)" ;;
esac

case "$arch" in
  arm64 | x64) ;;
  *) die "Unsupported CPU architecture: $(uname -m 2>/dev/null || printf unknown)" ;;
esac

info "Installing ${package_name} for ${target}/${arch}..."

ensure_curl
ensure_tar
release_platform="$(resolve_release_platform)"
ensure_bun

tag="$(normalize_version "$version")"
tarball_version="${tag#v}"
release_target="${release_platform}-${arch}"
artifact_name="${package_name}-${tarball_version}-${release_target}.tgz"
tarball_url="${CW_TARBALL_URL:-https://github.com/${repo}/releases/download/${tag}/${artifact_name}}"
install_root="${CW_INSTALL_ROOT:-${HOME}/.local/share/${package_name}}"
install_dir="${install_root}/${tag}-${release_target}"

tmp_dir="$(mktemp -d 2>/dev/null || mktemp -d -t "${package_name}")"
trap cleanup_tmp_dir EXIT INT TERM

archive_path="${tmp_dir}/${artifact_name}"
extract_dir="${tmp_dir}/extract"
stage_dir="${tmp_dir}/stage"

info "Installing production release package: ${tarball_url}"
curl -fL "$tarball_url" -o "$archive_path"

mkdir -p "$extract_dir" "$stage_dir" "$install_root"
tar -xzf "$archive_path" -C "$extract_dir"

if [ ! -x "${extract_dir}/${package_name}/dist/bin/cw" ]; then
  die "Release package is missing executable dist/bin/cw."
fi

mv "${extract_dir}/${package_name}" "${stage_dir}/${package_name}"
rm -rf "$install_dir"
mv "${stage_dir}/${package_name}" "$install_dir"

global_bin_dir="$(resolve_global_bin_dir)"
mkdir -p "$global_bin_dir"
ln -sfn "${install_dir}/dist/bin/cw" "${global_bin_dir}/cw"
ln -sfn "${install_dir}/dist/bin/cw" "${global_bin_dir}/codex-web"

if [ -x "${global_bin_dir}/cw" ]; then
  info "Installed ${package_name}."
else
  info "Installed ${package_name}, but cw was not found at ${global_bin_dir}/cw."
fi

case ":$PATH:" in
  *":${global_bin_dir}:"*) ;;
  *)
    info "Add this to your shell profile if cw is not available in new shells:"
    info "  export PATH=\"${global_bin_dir}:\$PATH\""
    ;;
esac

info "Next steps:"
info "  cw doctor"
info "  cw start"

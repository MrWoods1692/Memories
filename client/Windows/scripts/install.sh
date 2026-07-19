#!/bin/bash
# Memories Client - Installation Script
# Supports: Debian/Ubuntu, Fedora/RHEL, Arch, AppImage, Flatpak, source build

set -e

APP_NAME="MemoriesClient"
VERSION="1.1.0"
INSTALL_DIR="/opt/MemoriesClient"
BIN_DIR="/usr/local/bin"
DESKTOP_DIR="/usr/share/applications"
ICON_DIR="/usr/share/icons/hicolor/256x256/apps"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
print_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO_ID="$ID"
        DISTRO_LIKE="${ID_LIKE:-}"
    elif [ -f /etc/debian_version ]; then
        DISTRO_ID="debian"
    elif [ -f /etc/arch-release ]; then
        DISTRO_ID="arch"
    else
        DISTRO_ID="unknown"
    fi
    print_info "Detected distribution: $DISTRO_ID"
}

install_deps_debian() {
    print_info "Installing dependencies for Debian/Ubuntu..."
    sudo apt-get update
    sudo apt-get install -y \
        build-essential cmake pkg-config \
        qt6-base-dev qt6-tools-dev qt6-tools-dev-tools \
        qt6-declarative-dev qt6-networkauth-dev \
        qt6-svg-dev libgl1-mesa-dev \
        libx11-dev libxcb1-dev libxkbcommon-dev \
        libgstreamer-plugins-base1.0-dev
}

install_deps_fedora() {
    print_info "Installing dependencies for Fedora/RHEL..."
    sudo dnf install -y \
        gcc-c++ cmake pkgconfig \
        qt6-qtbase-devel qt6-qttools-devel \
        qt6-qtdeclarative-devel qt6-qtnetworkauth-devel \
        qt6-qtsvg-devel mesa-libGL-devel \
        libX11-devel libxcb-devel libxkbcommon-devel
}

install_deps_arch() {
    print_info "Installing dependencies for Arch Linux..."
    sudo pacman -S --needed \
        base-devel cmake pkgconf \
        qt6-base qt6-tools qt6-declarative \
        qt6-networkauth qt6-svg \
        libx11 libxcb xcb-util
}

check_deps() {
    print_info "Checking dependencies..."

    if ! command -v cmake &>/dev/null; then
        print_warn "cmake not found, will install dependencies"
        return 1
    fi

    if ! command -v qmake6 &>/dev/null && ! pkg-config --exists Qt6Core 2>/dev/null; then
        print_warn "Qt6 not found, will install dependencies"
        return 1
    fi

    print_ok "All dependencies satisfied"
    return 0
}

build_from_source() {
    print_info "Building from source..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SOURCE_DIR="$(dirname "$SCRIPT_DIR")"
    BUILD_DIR="$SOURCE_DIR/build"

    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"

    cmake "$SOURCE_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
        -DBUILD_GUI=ON

    cmake --build . --parallel "$(nproc)"

    print_ok "Build completed"
}

build_headless() {
    print_info "Building headless version..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SOURCE_DIR="$(dirname "$SCRIPT_DIR")"
    BUILD_DIR="$SOURCE_DIR/build-headless"

    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"

    cmake "$SOURCE_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_GUI=OFF

    cmake --build . --parallel "$(nproc)"

    print_ok "Headless build completed"
}

install_binaries() {
    print_info "Installing binaries..."

    BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../build"

    # Create install directory
    sudo mkdir -p "$INSTALL_DIR/bin"

    # Copy binary
    sudo cp "$BUILD_DIR/MemoriesClient" "$INSTALL_DIR/bin/"

    # Create wrapper script
    sudo tee "$BIN_DIR/memories-client" > /dev/null << 'EOF'
#!/bin/bash
exec /opt/MemoriesClient/bin/MemoriesClient "$@"
EOF
    sudo chmod +x "$BIN_DIR/memories-client"

    print_ok "Binaries installed"
}

install_desktop_entry() {
    print_info "Creating desktop entry..."

    sudo mkdir -p "$DESKTOP_DIR"

    sudo tee "$DESKTOP_DIR/memories-client.desktop" > /dev/null << EOF
[Desktop Entry]
Type=Application
Name=Memories Client
Comment=Image management client for Memories
Exec=memories-client
Icon=memories-client
Categories=Graphics;Photography;Network;
Terminal=false
StartupNotify=true
Keywords=images;photos;upload;gallery;
EOF

    sudo update-desktop-database 2>/dev/null || true
    print_ok "Desktop entry created"
}

install_headless() {
    print_info "Installing headless version..."

    BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../build-headless"
    sudo cp "$BUILD_DIR/MemoriesClient-headless" "$BIN_DIR/memories-client-headless"

    print_ok "Headless version installed to $BIN_DIR/memories-client-headless"
}

create_deb() {
    print_info "Creating .deb package..."

    BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../build"
    cd "$BUILD_DIR"

    cpack -G DEB

    print_ok "DEB package created in $BUILD_DIR"
}

create_rpm() {
    print_info "Creating .rpm package..."

    BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../build"
    cd "$BUILD_DIR"

    cpack -G RPM

    print_ok "RPM package created in $BUILD_DIR"
}

create_appimage() {
    print_info "Creating AppImage..."

    BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../build"

    cd "$BUILD_DIR"
    cmake --install . --prefix AppDir

    if command -v linuxdeployqt &>/dev/null; then
        linuxdeployqt AppDir/usr/share/applications/memories-client.desktop \
            -appimage -qmake=qmake6
        print_ok "AppImage created"
    else
        print_warn "linuxdeployqt not found. Install it for AppImage creation."
        print_info "You can also use cpack: cd build && cpack -G AppImage"
    fi
}

show_usage() {
    cat << EOF
Memories Client - Installation Script

Usage: $0 [COMMAND]

Commands:
  install           Full install (deps + build + install) [default]
  install-headless  Install headless-only version
  build             Build from source only
  build-headless    Build headless version only
  deps              Install dependencies only
  deb               Create .deb package after build
  rpm               Create .rpm package after build
  appimage          Create AppImage after build
  all-packages      Build and create all packages
  uninstall         Remove installation
  help              Show this help

Options:
  --prefix DIR      Installation prefix (default: $INSTALL_DIR)

Examples:
  $0                          # Full GUI install
  $0 install-headless         # Headless only
  $0 build && $0 deb          # Build and package as .deb
  $0 all-packages             # Build all package formats
EOF
}

uninstall() {
    print_info "Uninstalling Memories Client..."

    sudo rm -f "$BIN_DIR/memories-client"
    sudo rm -f "$BIN_DIR/memories-client-headless"
    sudo rm -f "$DESKTOP_DIR/memories-client.desktop"
    sudo rm -rf "$INSTALL_DIR"

    print_ok "Uninstalled"
}

main() {
    COMMAND="${1:-install}"

    case "$COMMAND" in
        install)
            detect_distro
            if ! check_deps; then
                case "$DISTRO_ID" in
                    debian|ubuntu|linuxmint|pop|elementary|zorin)
                        install_deps_debian ;;
                    fedora|rhel|centos|rocky|alma)
                        install_deps_fedora ;;
                    arch|manjaro|endeavouros)
                        install_deps_arch ;;
                    *)
                        print_error "Unsupported distribution: $DISTRO_ID"
                        print_info "Please install Qt6 development packages manually"
                        exit 1 ;;
                esac
            fi
            build_from_source
            install_binaries
            install_desktop_entry
            print_ok "Installation complete! Run 'memories-client' to start."
            ;;

        install-headless)
            detect_distro
            if ! check_deps; then
                case "$DISTRO_ID" in
                    debian|ubuntu) install_deps_debian ;;
                    fedora|rhel) install_deps_fedora ;;
                    arch) install_deps_arch ;;
                esac
            fi
            build_headless
            install_headless
            print_ok "Headless installation complete! Run 'memories-client-headless --help'"
            ;;

        build)
            detect_distro
            if ! check_deps; then
                case "$DISTRO_ID" in
                    debian|ubuntu) install_deps_debian ;;
                    fedora|rhel) install_deps_fedora ;;
                    arch) install_deps_arch ;;
                esac
            fi
            build_from_source
            ;;

        build-headless)
            detect_distro
            if ! check_deps; then
                case "$DISTRO_ID" in
                    debian|ubuntu) install_deps_debian ;;
                    fedora|rhel) install_deps_fedora ;;
                    arch) install_deps_arch ;;
                esac
            fi
            build_headless
            ;;

        deps)
            detect_distro
            case "$DISTRO_ID" in
                debian|ubuntu|linuxmint|pop) install_deps_debian ;;
                fedora|rhel|centos|rocky) install_deps_fedora ;;
                arch|manjaro) install_deps_arch ;;
                *) print_error "Unsupported distribution" ; exit 1 ;;
            esac
            ;;

        deb)
            build_from_source
            create_deb
            ;;

        rpm)
            build_from_source
            create_rpm
            ;;

        appimage)
            build_from_source
            create_appimage
            ;;

        all-packages)
            build_from_source
            create_deb
            create_rpm
            print_ok "All packages created in build directory"
            ;;

        uninstall)
            uninstall
            ;;

        help|--help|-h)
            show_usage
            ;;

        *)
            print_error "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"

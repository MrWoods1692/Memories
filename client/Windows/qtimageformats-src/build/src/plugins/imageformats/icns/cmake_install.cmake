# Install script for directory: C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/src/plugins/imageformats/icns

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "/Qt/6.8.0/mingw_64")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "Release")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "FALSE")
endif()

# Set path to fallback-tool for dependency-resolution.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "C:/Qt/Tools/mingw1310_64/bin/objdump.exe")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Devel" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui" TYPE FILE FILES
    "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/lib/cmake/Qt6Gui/Qt6QICNSPluginConfig.cmake"
    "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/lib/cmake/Qt6Gui/Qt6QICNSPluginConfigVersion.cmake"
    "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/lib/cmake/Qt6Gui/Qt6QICNSPluginConfigVersionImpl.cmake"
    )
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/plugins/imageformats" TYPE MODULE FILES "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/plugins/imageformats/qicns.dll")
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/plugins/imageformats/qicns.dll" AND
     NOT IS_SYMLINK "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/plugins/imageformats/qicns.dll")
    if(CMAKE_INSTALL_DO_STRIP)
      execute_process(COMMAND "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/bin/qt-internal-strip.bat" "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/plugins/imageformats/qicns.dll")
    endif()
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui/Qt6QICNSPluginTargets.cmake")
    file(DIFFERENT _cmake_export_file_changed FILES
         "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui/Qt6QICNSPluginTargets.cmake"
         "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/src/plugins/imageformats/icns/CMakeFiles/Export/186cdab8ebd5e47f6ef8450c9fc81ba1/Qt6QICNSPluginTargets.cmake")
    if(_cmake_export_file_changed)
      file(GLOB _cmake_old_config_files "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui/Qt6QICNSPluginTargets-*.cmake")
      if(_cmake_old_config_files)
        string(REPLACE ";" ", " _cmake_old_config_files_text "${_cmake_old_config_files}")
        message(STATUS "Old export file \"$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui/Qt6QICNSPluginTargets.cmake\" will be replaced.  Removing files [${_cmake_old_config_files_text}].")
        unset(_cmake_old_config_files_text)
        file(REMOVE ${_cmake_old_config_files})
      endif()
      unset(_cmake_old_config_files)
    endif()
    unset(_cmake_export_file_changed)
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui" TYPE FILE FILES "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/src/plugins/imageformats/icns/CMakeFiles/Export/186cdab8ebd5e47f6ef8450c9fc81ba1/Qt6QICNSPluginTargets.cmake")
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui" TYPE FILE FILES "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/src/plugins/imageformats/icns/CMakeFiles/Export/186cdab8ebd5e47f6ef8450c9fc81ba1/Qt6QICNSPluginTargets-release.cmake")
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/plugins/imageformats" TYPE FILE FILES "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/plugins/imageformats/qicns.debug")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/Qt6Gui" TYPE FILE FILES "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/lib/cmake/Qt6Gui/Qt6QICNSPluginAdditionalTargetInfo.cmake")
endif()

string(REPLACE ";" "\n" CMAKE_INSTALL_MANIFEST_CONTENT
       "${CMAKE_INSTALL_MANIFEST_FILES}")
if(CMAKE_INSTALL_LOCAL_ONLY)
  file(WRITE "C:/Users/16237/Desktop/idoknow/Memories-Client/Windows/qtimageformats-src/build/src/plugins/imageformats/icns/install_local_manifest.txt"
     "${CMAKE_INSTALL_MANIFEST_CONTENT}")
endif()

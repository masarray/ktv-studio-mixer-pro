cmake_minimum_required(VERSION 3.21)

project(SonkupikStudioNative VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Quick QuickControls2)
qt_standard_project_setup(REQUIRES 6.8)

qt_add_executable(sonkupik_studio_native WIN32
    src/main.cpp
    src/StudioEngine.cpp
    src/StudioEngine.h
)

set_source_files_properties(qml/theme/Theme.qml
    PROPERTIES QT_QML_SINGLETON_TYPE TRUE
)

qt_add_qml_module(sonkupik_studio_native
    URI SonkupikStudio
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/theme/Theme.qml
        qml/components/SoftButton.qml
        qml/components/LucideIcon.qml
        qml/components/StudioComboBox.qml
        qml/components/StudioPanel.qml
        qml/components/StudioKnob.qml
        qml/components/StudioFader.qml
        qml/components/LevelMeter.qml
        qml/components/ChannelStrip.qml
        qml/components/EqGraph.qml
        qml/components/CompressorGraph.qml
        qml/components/KeyControl.qml
        qml/components/MusicControlPanel.qml
        qml/components/ValueField.qml
        qml/components/ParameterSlider.qml
        qml/components/InputFader.qml
        qml/components/PresetPanel.qml
        qml/components/BandInspector.qml
        qml/components/MusicInputPanel.qml
        qml/components/MusicTonePanel.qml
        qml/components/FilterPanel.qml
        qml/components/MasterStripPanel.qml
)

set(SONKUPIK_LOGO "${CMAKE_CURRENT_SOURCE_DIR}/../src/assets/sonkupik-logo.png")
set_source_files_properties("${SONKUPIK_LOGO}" PROPERTIES QT_RESOURCE_ALIAS "assets/sonkupik-logo.png")
qt_add_resources(sonkupik_studio_native brand_assets
    PREFIX "/"
    FILES "${SONKUPIK_LOGO}"
)

target_link_libraries(sonkupik_studio_native
    PRIVATE
        Qt6::Quick
        Qt6::QuickControls2
)

set_target_properties(sonkupik_studio_native PROPERTIES
    OUTPUT_NAME "SONKUPIK-STUDIO-Native-UI"
)

qt_import_qml_plugins(sonkupik_studio_native)

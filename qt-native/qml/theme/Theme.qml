pragma Singleton
import QtQuick

QtObject {
    readonly property string fontFamily: "Segoe UI Variable Text"

    readonly property color bg: "#080C10"
    readonly property color chassis: "#0D1217"
    readonly property color bgRaised: "#11171D"
    readonly property color panel: "#141B22"
    readonly property color panelRaised: "#192129"
    readonly property color recessed: "#06090C"
    readonly property color control: "#182027"
    readonly property color controlRaised: "#222C35"
    readonly property color controlHover: "#27323C"
    readonly property color border: "#2B3640"
    readonly property color borderSoft: "#1D262E"
    readonly property color highlight: "#43515C"
    readonly property color focus: "#8CF4EC"

    readonly property color text: "#F4F7F9"
    readonly property color textSoft: "#C9D1D8"
    readonly property color textDim: "#87939E"
    readonly property color textFaint: "#5B6873"

    readonly property color accent: "#5EDDD4"
    readonly property color accentSoft: "#405EDDD4"
    readonly property color accentFaint: "#185EDDD4"
    readonly property color amber: "#F0B928"
    readonly property color amberSoft: "#40F0B928"
    readonly property color amberFaint: "#18F0B928"
    readonly property color blue: "#69AEEA"
    readonly property color violet: "#A58AE8"
    readonly property color red: "#F36B6B"
    readonly property color green: "#57D49A"

    readonly property int radiusSmall: 5
    readonly property int radius: 8
    readonly property int radiusLarge: 10

    readonly property int gapXS: 4
    readonly property int gapS: 7
    readonly property int gap: 10
    readonly property int gapL: 14

    readonly property int textXS: 9
    readonly property int textS: 10
    readonly property int textM: 11
    readonly property int textL: 13
    readonly property int textXL: 16
}

pragma Singleton
import QtQuick

QtObject {
    readonly property string fontFamily: "Plus Jakarta Sans"

    readonly property color bg: "#070A0D"
    readonly property color chassis: "#0B0F13"
    readonly property color bgRaised: "#0F1419"
    readonly property color panel: "#121820"
    readonly property color panelRaised: "#182029"
    readonly property color recessed: "#070A0D"
    readonly property color control: "#1A222B"
    readonly property color controlRaised: "#222C36"
    readonly property color border: "#2A3540"
    readonly property color borderSoft: "#1B242D"
    readonly property color highlight: "#34414C"

    readonly property color text: "#F4F7F9"
    readonly property color textSoft: "#C2CBD3"
    readonly property color textDim: "#778490"
    readonly property color textFaint: "#505D68"

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
    readonly property int radiusLarge: 11

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

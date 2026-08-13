pragma Singleton
import QtQuick

QtObject {
    readonly property string fontFamily: "Plus Jakarta Sans"

    readonly property color bg: "#080A0D"
    readonly property color bgRaised: "#0D1014"
    readonly property color panel: "#11151A"
    readonly property color panelRaised: "#161B21"
    readonly property color control: "#1A2027"
    readonly property color border: "#28313A"
    readonly property color borderSoft: "#1D242B"

    readonly property color text: "#F2F5F7"
    readonly property color textSoft: "#B5BEC7"
    readonly property color textDim: "#77828D"

    readonly property color accent: "#65DDD4"
    readonly property color accentSoft: "#3465DDD4"
    readonly property color accentFaint: "#1465DDD4"
    readonly property color blue: "#79B9F2"
    readonly property color violet: "#A997F4"
    readonly property color amber: "#E6C36A"
    readonly property color red: "#F07878"
    readonly property color green: "#6BD6A1"

    readonly property int radiusSmall: 5
    readonly property int radius: 8
    readonly property int radiusLarge: 12

    readonly property int gapXS: 4
    readonly property int gapS: 8
    readonly property int gap: 12
    readonly property int gapL: 18

    readonly property int textXS: 10
    readonly property int textS: 11
    readonly property int textM: 12
    readonly property int textL: 14
    readonly property int textXL: 18
}

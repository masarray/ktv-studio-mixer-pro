import QtQuick
import QtQuick.Shapes

Item {
    id: root

    property string name: "circle-dot"
    property color color: Theme.textSoft
    property real strokeWidth: 1.8
    property bool filled: false

    implicitWidth: 16
    implicitHeight: 16

    // Geometry is taken from lucide-react 0.575.0 (ISC), already used by
    // this repository's web application. Multiple Lucide nodes are combined
    // into one lightweight Qt Shape path for the native UI.
    readonly property string pathData: {
        switch (name) {
        case "music-2":
            return "M12 18V2l7 4 M12 18 A4 4 0 1 1 4 18 A4 4 0 1 1 12 18"
        case "mic-2":
        case "mic-vocal":
            return "m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12 M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5 M21 7 A5 5 0 1 1 11 7 A5 5 0 1 1 21 7"
        case "sparkles":
            return "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z M20 2v4 M22 4h-4 M6 20 A2 2 0 1 1 2 20 A2 2 0 1 1 6 20"
        case "repeat-2":
            return "m2 9 3-3 3 3 M13 18H7a2 2 0 0 1-2-2V6 m17 9-3 3-3-3 M11 6h6a2 2 0 0 1 2 2v10"
        case "repeat":
            return "m17 2 4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 m-14 15-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3"
        case "speaker":
            return "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 M12 6h.01 M16 14 A4 4 0 1 1 8 14 A4 4 0 1 1 16 14 M12 14h.01"
        case "waves":
            return "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"
        case "radio-tower":
            return "M4.9 16.1C1 12.2 1 5.8 4.9 1.9 M7.8 4.7a6.14 6.14 0 0 0-.8 7.5 M14 9 A2 2 0 1 1 10 9 A2 2 0 1 1 14 9 M16.2 4.8c2 2 2.26 5.11.8 7.47 M19.1 1.9a9.96 9.96 0 0 1 0 14.1 M9.5 18h5 m-6.5 4 4-11 4 11"
        case "audio-waveform":
            return "M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"
        case "activity":
            return "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
        case "sliders-horizontal":
            return "M10 5H3 M12 19H3 M14 3v4 M16 17v4 M21 12h-9 M21 19h-5 M21 5h-7 M8 10v4 M8 12H3"
        case "settings-2":
            return "M14 17H5 M19 7h-9 M20 17 A3 3 0 1 1 14 17 A3 3 0 1 1 20 17 M10 7 A3 3 0 1 1 4 7 A3 3 0 1 1 10 7"
        case "play":
            return "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
        case "pause":
            return "M15 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M6 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        case "skip-back":
            return "M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z M3 20V4"
        case "skip-forward":
            return "M21 4v16 M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"
        case "bluetooth":
            return "m7 7 10 10-5 5V2l5 5L7 17"
        case "usb":
            return "M11 7 A1 1 0 1 1 9 7 A1 1 0 1 1 11 7 M5 20 A1 1 0 1 1 3 20 A1 1 0 1 1 5 20 M4.7 19.3 19 5 m2-2-3 1 2 2Z M9.26 7.68 5 12l2 5 m3-3 5 2 3.5-3.5 m-.5-.5 1-1 1 1-1 1Z"
        case "plug":
            return "M12 22v-5 M15 8V2 M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z M9 8V2"
        case "cable":
            return "M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z M17 21v-2 M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10 M21 21v-2 M3 5V3 M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z M7 5V3"
        case "volume-x":
            return "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z M22 9l-6 6 M16 9l6 6"
        case "download":
            return "M12 15V3 M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 m4-5 5 5 5-5"
        case "upload":
            return "M12 3v12 m5-7-5-5-5 5 M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        case "rotate-ccw":
            return "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5"
        case "chevron-left":
            return "m15 18-6-6 6-6"
        case "chevron-right":
            return "m9 18 6-6-6-6"
        case "chevron-down":
            return "m6 9 6 6 6-6"
        default:
            return "M22 12 A10 10 0 1 1 2 12 A10 10 0 1 1 22 12 M13 12 A1 1 0 1 1 11 12 A1 1 0 1 1 13 12"
        }
    }

    Shape {
        width: 24
        height: 24
        anchors.centerIn: parent
        transformOrigin: Item.Center
        scale: Math.min(root.width, root.height) / 24

        ShapePath {
            strokeColor: root.color
            strokeWidth: root.strokeWidth
            fillColor: root.filled ? root.color : "transparent"
            capStyle: ShapePath.RoundCap
            joinStyle: ShapePath.RoundJoin
            PathSvg { path: root.pathData }
        }
    }
}

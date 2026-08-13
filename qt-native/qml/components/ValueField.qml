import QtQuick

Item {
    id: root

    property string title: "VALUE"
    property real value: 0
    property real from: -24
    property real to: 24
    property real step: 0.1
    property real defaultValue: 0
    property int decimals: 1
    property string unit: ""
    property color accentColor: Theme.amber
    property bool logarithmic: false
    signal valueEdited(real newValue)

    implicitWidth: 104
    implicitHeight: 50
    activeFocusOnTab: true

    property bool dragging: false
    property real pressY: 0
    property real pressValue: 0

    function clamp(v) { return Math.max(from, Math.min(to, v)) }
    function quantize(v, fine) {
        var s = fine ? step / 10 : step
        return Number(clamp(Math.round(v / s) * s).toFixed(Math.max(decimals + 1, 3)))
    }
    function nudge(direction, fine) { valueEdited(quantize(value + direction * (fine ? step / 10 : step), fine)) }
    function formatted(v) {
        if (unit === "Hz" && v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 1 : 2) + "k"
        return Number(v).toFixed(decimals)
    }

    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Up || event.key === Qt.Key_Right) {
            nudge(1, (event.modifiers & Qt.ShiftModifier) !== 0); event.accepted = true
        } else if (event.key === Qt.Key_Down || event.key === Qt.Key_Left) {
            nudge(-1, (event.modifiers & Qt.ShiftModifier) !== 0); event.accepted = true
        } else if (event.key === Qt.Key_Home) {
            valueEdited(defaultValue); event.accepted = true
        }
    }

    Text {
        anchors.left: parent.left
        anchors.top: parent.top
        text: root.title
        color: Theme.textDim
        font.family: Theme.fontFamily
        font.pixelSize: 8
        font.weight: Font.DemiBold
        font.letterSpacing: 0.75
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 30
        radius: 5
        color: pointer.pressed ? "#0F151A" : pointer.containsMouse ? "#0C1217" : "#080C10"
        border.width: 1
        border.color: root.activeFocus ? Theme.focus : pointer.containsMouse ? Theme.highlight : Theme.borderSoft
        Behavior on border.color { ColorAnimation { duration: 80 } }

        Row {
            anchors.centerIn: parent
            spacing: 4
            Text {
                text: root.formatted(root.value)
                color: root.activeFocus ? Theme.text : root.accentColor
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textM
                font.weight: Font.Bold
            }
            Text {
                visible: root.unit.length > 0
                text: root.unit
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: 8
                anchors.baseline: parent.children[0].baseline
            }
        }

        MouseArea {
            id: pointer
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.SizeVerCursor
            onPressed: function(event) {
                root.forceActiveFocus()
                root.dragging = true
                root.pressY = event.y
                root.pressValue = root.value
            }
            onPositionChanged: function(event) {
                if (!pressed) return
                var fine = (event.modifiers & Qt.ShiftModifier) !== 0
                var pixelsPerStep = fine ? 16 : 5
                root.valueEdited(root.quantize(root.pressValue + (root.pressY - event.y) / pixelsPerStep * root.step, fine))
            }
            onReleased: root.dragging = false
            onCanceled: root.dragging = false
            onDoubleClicked: root.valueEdited(root.defaultValue)
            onWheel: function(event) {
                root.forceActiveFocus()
                root.nudge(event.angleDelta.y > 0 ? 1 : -1, (event.modifiers & Qt.ShiftModifier) !== 0)
                event.accepted = true
            }
        }
    }
}

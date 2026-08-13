import QtQuick

Item {
    id: root

    property real value: -6.0
    property real from: -60.0
    property real to: 10.0
    property real defaultValue: 0.0
    property color accentColor: Theme.accent
    property bool selected: false

    signal valueEdited(real newValue)

    implicitWidth: 54
    implicitHeight: 170

    property real previewValue: value
    property bool dragging: false

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
    function valueToNorm(v) { return clamp((v - from) / (to - from), 0, 1) }
    function normToValue(n) { return from + clamp(n, 0, 1) * (to - from) }

    onValueChanged: if (!dragging) previewValue = value

    Rectangle {
        id: railGlow
        width: 5
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.topMargin: 8
        anchors.bottomMargin: 8
        radius: 3
        color: "#0A0D10"
        border.width: 1
        border.color: Theme.borderSoft
    }

    Rectangle {
        width: 2
        anchors.horizontalCenter: railGlow.horizontalCenter
        anchors.bottom: railGlow.bottom
        anchors.bottomMargin: 2
        height: Math.max(0, (railGlow.height - 4) * root.valueToNorm(root.previewValue))
        radius: 1
        color: root.accentColor
        opacity: root.selected || root.dragging ? 0.78 : 0.30
        Behavior on height { SmoothedAnimation { velocity: 900 } }
    }

    Repeater {
        model: 7
        delegate: Rectangle {
            required property int index
            width: index === 3 ? 10 : 6
            height: 1
            color: index === 3 ? Theme.textDim : Theme.border
            x: railGlow.x - width - 7
            y: 8 + index * (railGlow.height - 16) / 6
        }
    }

    Rectangle {
        id: cap
        width: 38
        height: 12
        radius: 3
        anchors.horizontalCenter: railGlow.horizontalCenter
        y: 8 + (1 - root.valueToNorm(root.previewValue)) * (railGlow.height - height - 16)
        border.width: 1
        border.color: root.selected || root.dragging ? root.accentColor : "#4A545E"
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#39424B" }
            GradientStop { position: 0.48; color: "#252C33" }
            GradientStop { position: 1.0; color: "#171C21" }
        }

        Behavior on y { SmoothedAnimation { velocity: 900 } }
        Behavior on border.color { ColorAnimation { duration: 90 } }

        Rectangle {
            width: parent.width - 8
            height: 1
            anchors.centerIn: parent
            color: root.dragging ? root.accentColor : "#919AA3"
            opacity: 0.85
        }
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        cursorShape: Qt.SizeVerCursor

        function updateFromY(yPos) {
            var top = 8 + cap.height / 2
            var bottom = root.height - 8 - cap.height / 2
            var n = 1 - root.clamp((yPos - top) / (bottom - top), 0, 1)
            root.previewValue = root.normToValue(n)
            root.valueEdited(root.previewValue)
        }

        onPressed: function(event) {
            root.dragging = true
            updateFromY(event.y)
        }
        onPositionChanged: function(event) { if (pressed) updateFromY(event.y) }
        onReleased: root.dragging = false
        onCanceled: root.dragging = false
        onDoubleClicked: root.valueEdited(root.defaultValue)
        onWheel: function(event) {
            var step = (event.modifiers & Qt.ShiftModifier) !== 0 ? 0.1 : 0.5
            root.valueEdited(root.clamp(root.value + (event.angleDelta.y > 0 ? step : -step), root.from, root.to))
            event.accepted = true
        }
    }
}

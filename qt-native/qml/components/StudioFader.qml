import QtQuick

Item {
    id: root

    property real value: -6.0
    property real from: -60.0
    property real to: 10.0
    property real defaultValue: 0.0
    property color accentColor: Theme.accent
    property bool selected: false
    property real step: 0.5
    signal valueEdited(real newValue)

    implicitWidth: 62
    implicitHeight: 182

    property real previewValue: value
    property bool dragging: false
    property bool hovered: pointer.containsMouse

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
    function valueToNorm(v) { return clamp((v - from) / (to - from), 0, 1) }
    function normToValue(n) { return from + clamp(n, 0, 1) * (to - from) }
    function quantize(v, fine) {
        var s = fine ? step / 5 : step
        return clamp(Math.round(v / s) * s, from, to)
    }
    function nudge(direction, fine) {
        var next = quantize(value + direction * (fine ? step / 5 : step), fine)
        previewValue = next
        valueEdited(next)
    }

    activeFocusOnTab: true
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Up || event.key === Qt.Key_Right) {
            nudge(1, (event.modifiers & Qt.ShiftModifier) !== 0)
            event.accepted = true
        } else if (event.key === Qt.Key_Down || event.key === Qt.Key_Left) {
            nudge(-1, (event.modifiers & Qt.ShiftModifier) !== 0)
            event.accepted = true
        } else if (event.key === Qt.Key_Home) {
            previewValue = defaultValue
            valueEdited(defaultValue)
            event.accepted = true
        }
    }

    onValueChanged: if (!dragging) previewValue = value

    Rectangle {
        anchors.fill: parent
        radius: 8
        color: root.activeFocus || root.dragging || root.selected ? "#10272A" : "transparent"
        opacity: root.activeFocus || root.dragging ? 0.72 : root.selected ? 0.38 : 0
        border.width: 1
        border.color: root.activeFocus || root.dragging ? Theme.accentSoft : "transparent"
        Behavior on opacity { NumberAnimation { duration: 110 } }
    }

    Rectangle {
        id: well
        width: 12
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.topMargin: 6
        anchors.bottomMargin: 6
        radius: 6
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#202B33" }
            GradientStop { position: 0.10; color: "#050708" }
            GradientStop { position: 0.88; color: "#020304" }
            GradientStop { position: 1.0; color: "#1B252C" }
        }
        border.width: 1
        border.color: root.activeFocus ? Theme.focus : root.hovered ? Theme.borderSoft : "#030405"
        Behavior on border.color { ColorAnimation { duration: 80 } }

        Rectangle {
            width: 3
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.margins: 4
            radius: 1.5
            color: "#000000"
        }
        Rectangle {
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.topMargin: 6
            anchors.bottomMargin: 6
            anchors.leftMargin: 2
            width: 1
            color: "#FFFFFF"
            opacity: 0.08
        }
    }

    Repeater {
        model: 13
        delegate: Item {
            required property int index
            readonly property bool major: index % 3 === 0
            readonly property bool centerTick: index === 6
            width: root.width
            height: 2
            y: 9 + index * (root.height - 18) / 12
            Rectangle {
                width: parent.major ? 13 : 7
                height: 1
                x: 3
                y: 1
                color: "#020405"
                opacity: 0.92
            }
            Rectangle {
                width: parent.major ? 13 : 7
                height: 1
                x: 3
                color: parent.centerTick && (root.activeFocus || root.dragging || root.selected)
                       ? root.accentColor : parent.major ? "#697985" : "#3C4A54"
                opacity: parent.major ? 0.92 : 0.74
            }
            Rectangle {
                width: parent.major ? 13 : 7
                height: 1
                anchors.right: parent.right
                anchors.rightMargin: 3
                y: 1
                color: "#020405"
                opacity: 0.92
            }
            Rectangle {
                width: parent.major ? 13 : 7
                height: 1
                anchors.right: parent.right
                anchors.rightMargin: 3
                color: parent.centerTick && (root.activeFocus || root.dragging || root.selected)
                       ? root.accentColor : parent.major ? "#697985" : "#3C4A54"
                opacity: parent.major ? 0.92 : 0.74
            }
        }
    }

    Rectangle {
        id: capShadow
        width: 31
        height: 20
        radius: 9
        anchors.horizontalCenter: parent.horizontalCenter
        y: cap.y + 2
        color: "#000000"
        opacity: 0.55
    }

    Rectangle {
        id: cap
        width: 28
        height: 17
        radius: 7
        anchors.horizontalCenter: parent.horizontalCenter
        y: 8 + (1 - root.valueToNorm(root.previewValue)) * (root.height - height - 16)
        border.width: 1
        border.color: root.dragging || root.activeFocus ? root.accentColor : root.hovered ? Theme.highlight : "#090C0F"
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#87939D" }
            GradientStop { position: 0.13; color: "#65717B" }
            GradientStop { position: 0.48; color: "#39434C" }
            GradientStop { position: 1.0; color: "#171D22" }
        }
        Behavior on y { SmoothedAnimation { velocity: 1100 } }
        Behavior on border.color { ColorAnimation { duration: 85 } }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.leftMargin: 4
            anchors.rightMargin: 4
            anchors.topMargin: 2
            height: 1
            color: "#FFFFFF"
            opacity: 0.20
        }
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.leftMargin: 5
            anchors.rightMargin: 5
            anchors.verticalCenter: parent.verticalCenter
            height: 2
            radius: 1
            color: root.dragging || root.activeFocus || root.selected ? root.accentColor : "#C8D1D7"
            opacity: root.dragging || root.activeFocus || root.selected ? 0.95 : 0.54
        }
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.leftMargin: 4
            anchors.rightMargin: 4
            height: 1
            color: "#000000"
            opacity: 0.72
        }
    }

    MouseArea {
        id: pointer
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.SizeVerCursor
        function updateFromY(yPos) {
            var top = 8 + cap.height / 2
            var bottom = root.height - 8 - cap.height / 2
            var n = 1 - root.clamp((yPos - top) / (bottom - top), 0, 1)
            root.previewValue = root.quantize(root.normToValue(n), false)
            root.valueEdited(root.previewValue)
        }
        onPressed: function(e) { root.forceActiveFocus(); root.dragging = true; updateFromY(e.y) }
        onPositionChanged: function(e) { if (pressed) updateFromY(e.y) }
        onReleased: root.dragging = false
        onCanceled: root.dragging = false
        onDoubleClicked: { root.previewValue = root.defaultValue; root.valueEdited(root.defaultValue) }
        onWheel: function(e) {
            root.forceActiveFocus()
            root.nudge(e.angleDelta.y > 0 ? 1 : -1, (e.modifiers & Qt.ShiftModifier) !== 0)
            e.accepted = true
        }
    }
}

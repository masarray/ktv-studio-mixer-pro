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

    implicitWidth: 62
    implicitHeight: 182

    property real previewValue: value
    property bool dragging: false

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
    function valueToNorm(v) { return clamp((v - from) / (to - from), 0, 1) }
    function normToValue(n) { return from + clamp(n, 0, 1) * (to - from) }

    onValueChanged: if (!dragging) previewValue = value

    Rectangle {
        id: well
        width: 18
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.topMargin: 6
        anchors.bottomMargin: 6
        radius: 8
        color: "#080B0E"
        border.width: 1
        border.color: "#1E2831"

        Rectangle {
            width: 4
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.margins: 5
            radius: 2
            color: "#030506"
        }

        Rectangle {
            width: 2
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottom: parent.bottom
            anchors.bottomMargin: 6
            height: Math.max(0, (parent.height - 12) * root.valueToNorm(root.previewValue))
            radius: 1
            color: root.accentColor
            opacity: root.selected || root.dragging ? 0.86 : 0.28
            Behavior on height { SmoothedAnimation { velocity: 1000 } }
        }
    }

    Repeater {
        model: 9
        delegate: Item {
            required property int index
            width: root.width
            height: 1
            y: 12 + index * (root.height - 24) / 8
            Rectangle {
                width: index === 6 ? 12 : index % 2 === 0 ? 9 : 6
                height: 1
                x: 3
                color: index === 6 ? "#7D8993" : "#34404A"
                opacity: index === 6 ? 0.8 : 0.62
            }
            Rectangle {
                width: index === 6 ? 12 : index % 2 === 0 ? 9 : 6
                height: 1
                anchors.right: parent.right
                anchors.rightMargin: 3
                color: index === 6 ? "#7D8993" : "#34404A"
                opacity: index === 6 ? 0.8 : 0.62
            }
        }
    }

    Rectangle {
        id: capShadow
        width: 48
        height: 18
        radius: 4
        anchors.horizontalCenter: parent.horizontalCenter
        y: cap.y + 2
        color: "#000000"
        opacity: 0.55
    }

    Rectangle {
        id: cap
        width: 48
        height: 17
        radius: 4
        anchors.horizontalCenter: parent.horizontalCenter
        y: 8 + (1 - root.valueToNorm(root.previewValue)) * (root.height - height - 16)
        border.width: 1
        border.color: root.dragging || root.selected ? root.accentColor : "#55616C"
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#4A5661" }
            GradientStop { position: 0.18; color: "#333D46" }
            GradientStop { position: 0.55; color: "#20272E" }
            GradientStop { position: 1.0; color: "#11161B" }
        }
        Behavior on y { SmoothedAnimation { velocity: 1100 } }
        Behavior on border.color { ColorAnimation { duration: 85 } }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.leftMargin: 6
            anchors.rightMargin: 6
            anchors.verticalCenter: parent.verticalCenter
            height: 2
            radius: 1
            color: root.dragging || root.selected ? root.accentColor : "#C7CFD5"
            opacity: root.dragging || root.selected ? 0.95 : 0.72
        }
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: 2
            height: 1
            color: "#FFFFFF"
            opacity: 0.12
        }
    }

    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.SizeVerCursor
        function updateFromY(yPos) {
            var top = 8 + cap.height / 2
            var bottom = root.height - 8 - cap.height / 2
            var n = 1 - root.clamp((yPos - top) / (bottom - top), 0, 1)
            root.previewValue = root.normToValue(n)
            root.valueEdited(root.previewValue)
        }
        onPressed: function(e) { root.dragging = true; updateFromY(e.y) }
        onPositionChanged: function(e) { if (pressed) updateFromY(e.y) }
        onReleased: root.dragging = false
        onCanceled: root.dragging = false
        onDoubleClicked: root.valueEdited(root.defaultValue)
        onWheel: function(e) {
            var step = (e.modifiers & Qt.ShiftModifier) !== 0 ? 0.1 : 0.5
            root.valueEdited(root.clamp(root.value + (e.angleDelta.y > 0 ? step : -step), root.from, root.to))
            e.accepted = true
        }
    }
}

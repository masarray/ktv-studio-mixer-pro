import QtQuick

Rectangle {
    id: root

    property alias text: label.text
    property bool checked: false
    property bool compact: false
    property bool danger: false
    property bool amber: false
    property string iconName: ""
    property bool iconOnly: false
    property bool neonAccent: false
    property bool iconFilled: false
    signal clicked()

    activeFocusOnTab: true
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Space || event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            root.clicked()
            event.accepted = true
        }
    }

    implicitWidth: compact ? 52 : 70
    implicitHeight: compact ? 26 : 30
    transformOrigin: Item.Center
    scale: mouse.pressed ? 0.955 : 1.0
    transform: Translate {
        id: pressTranslate
        y: mouse.pressed ? 2 : 0
        Behavior on y { NumberAnimation { duration: 65; easing.type: Easing.OutQuad } }
    }
    radius: Theme.radiusSmall
    border.width: 1
    border.color: root.activeFocus ? Theme.focus : danger ? Theme.red : checked || neonAccent ? (amber ? Theme.amber : Theme.accent) : mouse.containsMouse ? Theme.highlight : Theme.borderSoft
    color: "#0C1116"
    gradient: Gradient {
        GradientStop {
            position: 0.0
            color: root.danger ? (mouse.pressed ? "#2A1518" : "#442126")
                               : root.checked ? (root.amber ? (mouse.pressed ? "#332A14" : "#4A3C18") : (mouse.pressed ? "#173638" : "#235154"))
                                              : root.neonAccent ? (mouse.pressed ? "#173638" : mouse.containsMouse ? "#2A5559" : "#253B42")
                                              : mouse.pressed ? "#151B21" : mouse.containsMouse ? "#303B45" : "#29343D"
        }
        GradientStop {
            position: 0.52
            color: root.danger ? "#241315"
                               : root.checked ? (root.amber ? "#2B2413" : "#163032")
                                              : mouse.pressed ? "#10151A" : "#192129"
        }
        GradientStop {
            position: 1.0
            color: mouse.pressed ? "#0A0E12" : "#0C1116"
        }
    }

    Behavior on color { ColorAnimation { duration: 90 } }
    Behavior on border.color { ColorAnimation { duration: 90 } }
    Behavior on scale { NumberAnimation { duration: 55; easing.type: Easing.OutQuad } }

    Rectangle {
        anchors.fill: parent
        anchors.margins: -3
        radius: parent.radius + 3
        color: root.amber ? Theme.amber : Theme.accent
        opacity: mouse.pressed ? 0.08 : root.checked ? 0.18 : root.neonAccent ? (mouse.containsMouse ? 0.18 : 0.09) : 0
        z: -2
        Behavior on opacity { NumberAnimation { duration: 90 } }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: 1
        radius: parent.radius
        color: checked || neonAccent ? (amber ? Theme.amber : Theme.accent) : "#FFFFFF"
        opacity: mouse.pressed ? 0.02 : checked ? 0.66 : neonAccent ? 0.38 : mouse.containsMouse ? 0.13 : 0.09
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.leftMargin: 3
        anchors.rightMargin: 3
        height: mouse.pressed ? 1 : 2
        radius: 1
        color: "#000000"
        opacity: mouse.pressed ? 0.18 : 0.62
    }

    Row {
        anchors.centerIn: parent
        spacing: root.iconOnly || label.text.length === 0 ? 0 : 5

        Item {
            visible: root.iconName.length > 0
            width: root.compact ? 13 : 15
            height: width
            anchors.verticalCenter: parent.verticalCenter

            LucideIcon {
                anchors.centerIn: parent
                width: parent.width + 3
                height: width
                name: root.iconName
                color: root.danger ? Theme.red : root.amber ? Theme.amber : Theme.accent
                strokeWidth: 3.2
                filled: root.iconFilled
                opacity: root.checked || root.neonAccent ? (mouse.containsMouse ? 0.30 : 0.16) : 0
            }
            LucideIcon {
                anchors.centerIn: parent
                width: parent.width
                height: width
                name: root.iconName
                color: root.danger ? "#FFD8D8" : root.checked || root.neonAccent ? (root.amber ? Theme.amber : Theme.accent) : Theme.textSoft
                strokeWidth: 1.9
                filled: root.iconFilled
            }
        }

        Text {
            id: label
            visible: !root.iconOnly && text.length > 0
            anchors.verticalCenter: parent.verticalCenter
            color: danger ? "#FFD8D8" : checked ? Theme.text : Theme.textSoft
            font.family: Theme.fontFamily
            font.pixelSize: compact ? Theme.textXS : Theme.textS
            font.weight: checked ? Font.DemiBold : Font.Medium
            font.letterSpacing: 0.25
        }
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onPressed: root.forceActiveFocus()
        onClicked: root.clicked()
    }
}

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
    property bool transport: false
    property bool accentIcon: false
    signal clicked()

    readonly property bool activeAccent: root.checked || root.neonAccent
    readonly property color resolvedAccent: root.amber ? Theme.amber : Theme.accent

    activeFocusOnTab: true
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Space || event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            root.clicked()
            event.accepted = true
        }
    }

    implicitWidth: root.transport ? 29 : root.compact ? 52 : 70
    implicitHeight: root.transport ? 28 : root.compact ? 26 : 30
    transformOrigin: Item.Center
    scale: mouse.pressed ? (root.transport ? 0.965 : 0.955) : 1.0
    transform: Translate {
        id: pressTranslate
        y: mouse.pressed ? (root.transport ? 1 : 2) : 0
        Behavior on y { NumberAnimation { duration: 65; easing.type: Easing.OutQuad } }
    }
    radius: root.transport ? 5 : Theme.radiusSmall
    border.width: 1
    border.color: root.activeFocus ? Theme.focus
                 : root.danger ? Theme.red
                 : root.transport ? (root.activeAccent ? root.resolvedAccent : mouse.containsMouse ? "#53636F" : "#34414B")
                 : root.activeAccent ? root.resolvedAccent
                 : mouse.containsMouse ? Theme.highlight : Theme.borderSoft
    color: "#0C1116"
    gradient: Gradient {
        GradientStop {
            position: 0.0
            color: root.transport
                ? (root.danger ? (mouse.pressed ? "#281518" : "#3B1C21")
                   : root.activeAccent ? (mouse.pressed ? "#173638" : mouse.containsMouse ? "#2B5F61" : "#285154")
                   : mouse.pressed ? "#11171C" : mouse.containsMouse ? "#27333C" : "#202A32")
                : root.danger ? (mouse.pressed ? "#2A1518" : "#442126")
                : root.checked ? (root.amber ? (mouse.pressed ? "#332A14" : "#4A3C18") : (mouse.pressed ? "#173638" : "#235154"))
                : root.neonAccent ? (mouse.pressed ? "#173638" : mouse.containsMouse ? "#2A5559" : "#253B42")
                : mouse.pressed ? "#151B21" : mouse.containsMouse ? "#303B45" : "#29343D"
        }
        GradientStop {
            position: root.transport ? 0.46 : 0.52
            color: root.transport
                ? (root.danger ? "#1F1114" : root.activeAccent ? "#153234" : mouse.pressed ? "#0D1216" : "#141C22")
                : root.danger ? "#241315"
                : root.checked ? (root.amber ? "#2B2413" : "#163032")
                : mouse.pressed ? "#10151A" : "#192129"
        }
        GradientStop {
            position: 1.0
            color: root.transport ? (mouse.pressed ? "#05080B" : "#080D11") : mouse.pressed ? "#0A0E12" : "#0C1116"
        }
    }

    Behavior on border.color { ColorAnimation { duration: 90 } }
    Behavior on scale { NumberAnimation { duration: 55; easing.type: Easing.OutQuad } }

    Rectangle {
        anchors.fill: parent
        anchors.margins: root.transport ? -5 : -3
        radius: parent.radius + (root.transport ? 5 : 3)
        color: root.resolvedAccent
        opacity: mouse.pressed ? 0.06
                 : root.checked ? (root.transport ? 0.22 : 0.18)
                 : root.neonAccent ? (root.transport ? (mouse.containsMouse ? 0.20 : 0.13) : mouse.containsMouse ? 0.18 : 0.09)
                 : 0
        z: -3
        Behavior on opacity { NumberAnimation { duration: 100 } }
    }

    Rectangle {
        visible: root.transport
        anchors.fill: parent
        anchors.margins: 2
        radius: Math.max(2, parent.radius - 2)
        color: "transparent"
        border.width: 1
        border.color: root.activeAccent ? "#385EDDD4" : "#18FFFFFF"
        opacity: mouse.pressed ? 0.45 : 0.75
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: root.transport ? 3 : 0
        anchors.rightMargin: root.transport ? 3 : 0
        height: 1
        radius: parent.radius
        color: root.activeAccent ? root.resolvedAccent : "#FFFFFF"
        opacity: mouse.pressed ? 0.02
                 : root.checked ? (root.transport ? 0.78 : 0.66)
                 : root.neonAccent ? (root.transport ? 0.56 : 0.38)
                 : mouse.containsMouse ? 0.13 : root.transport ? 0.11 : 0.09
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
        opacity: mouse.pressed ? 0.18 : root.transport ? 0.76 : 0.62
    }

    Row {
        anchors.centerIn: parent
        spacing: root.iconOnly || label.text.length === 0 ? 0 : 5

        Item {
            visible: root.iconName.length > 0
            width: root.transport ? 14 : root.compact ? 13 : 15
            height: width
            anchors.verticalCenter: parent.verticalCenter

            LucideIcon {
                anchors.centerIn: parent
                width: parent.width + (root.transport ? 5 : 3)
                height: width
                name: root.iconName
                color: root.danger ? Theme.red : root.resolvedAccent
                strokeWidth: root.transport ? 3.6 : 3.2
                filled: root.iconFilled
                opacity: root.activeAccent ? (mouse.containsMouse ? 0.34 : root.transport ? 0.22 : 0.16) : 0
            }
            LucideIcon {
                anchors.centerIn: parent
                width: parent.width
                height: width
                name: root.iconName
                color: root.danger ? "#FFD8D8"
                     : root.activeAccent || root.accentIcon ? root.resolvedAccent
                     : root.transport ? "#A7BBC6" : Theme.textSoft
                strokeWidth: root.transport ? 2.0 : 1.9
                filled: root.iconFilled
            }
        }

        Text {
            id: label
            visible: !root.iconOnly && text.length > 0
            anchors.verticalCenter: parent.verticalCenter
            color: root.danger ? "#FFD8D8" : root.checked ? Theme.text : Theme.textSoft
            font.family: Theme.fontFamily
            font.pixelSize: root.compact ? Theme.textXS : Theme.textS
            font.weight: root.checked ? Font.DemiBold : Font.Medium
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

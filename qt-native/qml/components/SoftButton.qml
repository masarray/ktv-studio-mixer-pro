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
    clip: false

    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Space || event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            root.clicked()
            event.accepted = true
        }
    }

    implicitWidth: root.transport ? 29 : root.compact ? 52 : 70
    implicitHeight: root.transport ? 28 : root.compact ? 26 : 30
    transformOrigin: Item.Center
    scale: mouse.pressed ? (root.transport ? 0.975 : 0.965) : 1.0
    transform: Translate {
        y: mouse.pressed ? 1 : 0
        Behavior on y { NumberAnimation { duration: 55; easing.type: Easing.OutQuad } }
    }

    radius: root.transport ? 5 : Theme.radiusSmall
    border.width: 1
    border.color: root.activeFocus ? Theme.focus
                 : root.danger ? "#9E4C53"
                 : root.activeAccent ? Qt.rgba(root.resolvedAccent.r, root.resolvedAccent.g, root.resolvedAccent.b, root.transport ? 0.72 : 0.62)
                 : mouse.containsMouse ? "#465560"
                 : root.transport ? "#34414B" : Theme.borderSoft

    gradient: Gradient {
        GradientStop {
            position: 0.0
            color: root.danger ? (mouse.pressed ? "#211317" : "#30191D")
                 : root.activeAccent ? (mouse.pressed ? "#173034" : root.transport ? "#203B40" : "#20383C")
                 : mouse.pressed ? "#11171C"
                 : mouse.containsMouse ? "#26313A"
                 : root.transport ? "#202A32" : "#252F38"
        }
        GradientStop {
            position: 0.48
            color: root.danger ? "#1B1013"
                 : root.activeAccent ? (root.transport ? "#13272B" : "#152A2D")
                 : mouse.pressed ? "#0D1216" : "#151C22"
        }
        GradientStop {
            position: 1.0
            color: root.danger ? "#0D090B"
                 : root.activeAccent ? "#081216"
                 : "#080D11"
        }
    }

    Behavior on border.color { ColorAnimation { duration: 85 } }
    Behavior on scale { NumberAnimation { duration: 50; easing.type: Easing.OutQuad } }

    // Active tint stays completely inside the control bounds. This avoids
    // the old negative-margin glow being clipped by Qt Layout containers.
    Rectangle {
        anchors.fill: parent
        anchors.margins: 1
        radius: Math.max(2, parent.radius - 1)
        color: root.resolvedAccent
        opacity: root.activeAccent ? (root.transport ? 0.055 : 0.045) : 0
        Behavior on opacity { NumberAnimation { duration: 90 } }
    }

    // Console-style underglow: intentionally inset so every button keeps a
    // clean cyan/amber light without spilling outside its layout cell.
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.leftMargin: root.transport ? 4 : 5
        anchors.rightMargin: root.transport ? 4 : 5
        anchors.bottomMargin: 1
        height: root.transport ? 4 : 3
        radius: height / 2
        color: root.resolvedAccent
        opacity: root.activeAccent ? (mouse.pressed ? 0.16 : root.transport ? 0.30 : 0.22) : 0
        Behavior on opacity { NumberAnimation { duration: 90 } }
    }

    // One inner edge only for transport buttons; the previous extra border
    // stack made the top bar look dirty at native DPI scaling.
    Rectangle {
        visible: root.transport
        anchors.fill: parent
        anchors.margins: 2
        radius: Math.max(2, parent.radius - 2)
        color: "transparent"
        border.width: 1
        border.color: root.activeAccent ? "#285EDDD4" : "#12FFFFFF"
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: root.transport ? 4 : 3
        anchors.rightMargin: root.transport ? 4 : 3
        anchors.topMargin: 1
        height: 1
        color: root.activeAccent ? root.resolvedAccent : "#FFFFFF"
        opacity: root.activeAccent ? (root.transport ? 0.40 : 0.30)
                 : mouse.containsMouse ? 0.11 : 0.065
    }

    Row {
        anchors.centerIn: parent
        spacing: root.iconOnly || label.text.length === 0 ? 0 : 5

        Item {
            visible: root.iconName.length > 0
            width: root.transport ? 14 : root.compact ? 13 : 15
            height: width
            anchors.verticalCenter: parent.verticalCenter

            // Keep icon glow subtle and contained. The web console reads as
            // illuminated hardware because the focal light is on the glyph,
            // not because several outlines glow at once.
            LucideIcon {
                anchors.centerIn: parent
                width: parent.width + (root.transport ? 3 : 2)
                height: width
                name: root.iconName
                color: root.danger ? Theme.red : root.resolvedAccent
                strokeWidth: root.transport ? 3.0 : 2.8
                filled: root.iconFilled
                opacity: root.activeAccent ? (root.transport ? 0.14 : 0.10) : 0
            }
            LucideIcon {
                anchors.centerIn: parent
                width: parent.width
                height: width
                name: root.iconName
                color: root.danger ? "#FFD8D8"
                     : root.activeAccent || root.accentIcon ? root.resolvedAccent
                     : root.transport ? "#A7BBC6" : Theme.textSoft
                strokeWidth: root.transport ? 1.9 : 1.8
                filled: root.iconFilled
            }
        }

        Text {
            id: label
            visible: !root.iconOnly && text.length > 0
            anchors.verticalCenter: parent.verticalCenter
            color: root.danger ? "#FFD8D8"
                 : root.checked ? Theme.text
                 : root.activeAccent ? "#DDF9F6" : Theme.textSoft
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

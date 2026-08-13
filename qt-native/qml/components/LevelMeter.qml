import QtQuick

Item {
    id: root

    property real level: 0.0
    property real peak: Math.min(1.0, displayLevel + 0.07)
    property real displayLevel: level
    property color normalColor: Theme.accent

    implicitWidth: 12
    implicitHeight: 170

    Behavior on displayLevel { SmoothedAnimation { velocity: 2.8 } }

    Rectangle {
        anchors.fill: parent
        radius: 4
        color: "#06090B"
        border.width: 1
        border.color: Theme.borderSoft
    }

    Rectangle {
        id: fill
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.leftMargin: 2
        anchors.rightMargin: 2
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 2
        height: Math.max(2, (parent.height - 4) * Math.max(0, Math.min(1, root.displayLevel)))
        radius: 2
        gradient: Gradient {
            GradientStop { position: 0.0; color: root.displayLevel > 0.94 ? Theme.red : root.displayLevel > 0.82 ? Theme.amber : root.normalColor }
            GradientStop { position: 0.22; color: root.displayLevel > 0.94 ? Theme.red : root.displayLevel > 0.82 ? Theme.amber : root.normalColor }
            GradientStop { position: 1.0; color: "#2A817B" }
        }
    }

    Rectangle {
        width: parent.width + 4
        height: 1
        x: -2
        y: Math.max(1, (1 - Math.max(0, Math.min(1, root.peak))) * parent.height)
        color: root.peak > 0.94 ? Theme.red : root.peak > 0.82 ? Theme.amber : "#D8FEFB"
        opacity: 0.9
        Behavior on y { SmoothedAnimation { velocity: 650 } }
    }

    Repeater {
        model: 5
        delegate: Rectangle {
            required property int index
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.leftMargin: 2
            anchors.rightMargin: 2
            height: 1
            y: index * (root.height - 4) / 4 + 2
            color: "#FFFFFF"
            opacity: 0.055
        }
    }
}

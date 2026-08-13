import QtQuick
import QtQuick.Controls

ComboBox {
    id: control

    property string value: ""
    property color accentColor: Theme.amber
    signal valueEdited(string newValue)

    implicitHeight: 34
    leftPadding: 11
    rightPadding: 32
    topPadding: 0
    bottomPadding: 0
    currentIndex: Math.max(0, control.model.indexOf(control.value))
    hoverEnabled: true

    onActivated: function(index) {
        control.value = control.textAt(index)
        control.valueEdited(control.value)
    }

    contentItem: Text {
        leftPadding: 1
        text: control.displayText
        color: control.enabled ? Theme.textSoft : Theme.textFaint
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
        font.family: Theme.fontFamily
        font.pixelSize: Theme.textS
        font.weight: Font.DemiBold
        font.letterSpacing: 0.15
    }

    indicator: Item {
        x: control.width - width - 9
        y: (control.height - height) / 2
        width: 16
        height: 16

        LucideIcon {
            anchors.fill: parent
            name: "chevron-down"
            color: control.popup.visible || control.hovered ? control.accentColor : Theme.textDim
            strokeWidth: 2.1
            rotation: control.popup.visible ? 180 : 0
            Behavior on rotation { NumberAnimation { duration: 120; easing.type: Easing.OutCubic } }
            Behavior on color { ColorAnimation { duration: 100 } }
        }
    }

    background: Rectangle {
        radius: 6
        border.width: 1
        border.color: control.activeFocus || control.popup.visible
                      ? control.accentColor
                      : control.hovered ? "#6B5B24" : Theme.borderSoft
        gradient: Gradient {
            GradientStop { position: 0.0; color: control.down ? "#11120E" : control.hovered ? "#25251B" : "#171B1D" }
            GradientStop { position: 0.48; color: control.down ? "#0A0C0D" : "#101417" }
            GradientStop { position: 1.0; color: "#070A0C" }
        }
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.leftMargin: 5
            anchors.rightMargin: 5
            height: 1
            color: control.accentColor
            opacity: control.activeFocus || control.popup.visible ? 0.45 : 0.10
        }
        Rectangle {
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.right: parent.right
            anchors.rightMargin: 27
            width: 1
            color: Theme.borderSoft
        }
    }

    delegate: ItemDelegate {
        id: option
        required property var modelData
        required property int index
        width: control.width - 8
        height: 30
        leftPadding: 9
        rightPadding: 8
        highlighted: control.highlightedIndex === index

        contentItem: Text {
            text: option.modelData
            color: option.highlighted ? control.accentColor : Theme.textSoft
            verticalAlignment: Text.AlignVCenter
            font.family: Theme.fontFamily
            font.pixelSize: Theme.textS
            font.weight: option.highlighted ? Font.DemiBold : Font.Medium
        }
        background: Rectangle {
            radius: 5
            color: option.highlighted ? Theme.amberFaint : "transparent"
            border.width: option.highlighted ? 1 : 0
            border.color: Theme.amberSoft
        }
    }

    popup: Popup {
        y: control.height + 4
        width: control.width
        implicitHeight: Math.min(contentItem.implicitHeight + 8, 224)
        padding: 4
        z: 50

        contentItem: ListView {
            clip: true
            implicitHeight: contentHeight
            model: control.popup.visible ? control.delegateModel : null
            currentIndex: control.highlightedIndex
            spacing: 2
        }
        background: Rectangle {
            radius: 8
            color: "#10161B"
            border.width: 1
            border.color: "#46535D"
            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.margins: 5
                height: 1
                color: "#FFFFFF"
                opacity: 0.08
            }
        }
    }
}

import QtQuick
import QtQuick.Layouts

Item {
    id: root
    property string label: "INPUT"
    property real value: -3
    property real from: -60
    property real to: 10
    property color accentColor: Theme.accent
    property bool active: false
    signal valueEdited(real newValue)

    implicitWidth: 92
    implicitHeight: 230

    ColumnLayout {
        anchors.fill: parent
        spacing: 5

        SoftButton {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 58
            text: root.label
            compact: true
            checked: root.active
            onClicked: root.active = !root.active
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: root.label
            color: root.active ? root.accentColor : Theme.textDim
            font.family: Theme.fontFamily
            font.pixelSize: 8
            font.weight: Font.DemiBold
        }
        StudioFader {
            Layout.fillHeight: true
            Layout.preferredWidth: 64
            Layout.alignment: Qt.AlignHCenter
            value: root.value
            from: root.from
            to: root.to
            defaultValue: 0
            step: 0.5
            accentColor: root.accentColor
            selected: root.active
            onValueEdited: function(v) { root.valueEdited(v) }
        }
        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 58
            Layout.preferredHeight: 22
            radius: 5
            color: "#080C10"
            border.width: 1
            border.color: root.active ? root.accentColor : Theme.borderSoft
            Text {
                anchors.centerIn: parent
                text: root.value <= root.from + 0.1 ? "-∞" : root.value.toFixed(root.to > 20 ? 0 : 1) + (root.to > 20 ? "" : " dB")
                color: Theme.amber
                font.family: Theme.fontFamily
                font.pixelSize: 9
                font.weight: Font.Bold
            }
        }
    }
}

import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    required property var bandModel
    property int selectedIndex: 0
    property real frequency: 80
    property real gain: 0
    property real q: 1
    property color accentColor: Theme.accent

    signal frequencyEdited(real value)
    signal gainEdited(real value)
    signal qEdited(real value)
    signal resetRequested()

    width: 548
    height: 74
    radius: 8
    color: "#F012171D"
    border.width: 1
    border.color: "#46545E"

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: 8
        anchors.rightMargin: 8
        height: 1
        color: root.accentColor
        opacity: 0.55
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 8
        spacing: 8

        ColumnLayout {
            Layout.preferredWidth: 118
            spacing: 3
            Text {
                text: "BAND " + (root.selectedIndex + 1) + "  •  TYPE"
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: 8
                font.weight: Font.DemiBold
            }
            StudioComboBox {
                Layout.fillWidth: true
                Layout.preferredHeight: 34
                model: ["BELL", "LOW SHELF", "HIGH SHELF"]
                value: root.bandModel.get(root.selectedIndex).typeName
                accentColor: root.accentColor
                onValueEdited: function(v) { root.bandModel.setBandType(root.selectedIndex, v) }
            }
        }

        Rectangle { width: 1; Layout.fillHeight: true; color: Theme.borderSoft }

        ValueField {
            Layout.preferredWidth: 112
            title: "FREQ"
            value: root.frequency
            from: 20
            to: 20000
            step: 5
            defaultValue: root.frequency
            decimals: 0
            unit: "Hz"
            accentColor: Theme.amber
            onValueEdited: function(v) { root.frequencyEdited(v) }
        }
        ValueField {
            Layout.preferredWidth: 96
            title: "GAIN"
            value: root.gain
            from: -24
            to: 24
            step: 0.1
            defaultValue: 0
            decimals: 1
            unit: "dB"
            accentColor: root.accentColor
            onValueEdited: function(v) { root.gainEdited(v) }
        }
        ValueField {
            Layout.preferredWidth: 86
            title: "Q"
            value: root.q
            from: 0.1
            to: 30
            step: 0.1
            defaultValue: 1
            decimals: 2
            accentColor: Theme.textSoft
            onValueEdited: function(v) { root.qEdited(v) }
        }
        SoftButton {
            Layout.preferredWidth: 62
            Layout.preferredHeight: 34
            text: "RESET"
            compact: true
            onClicked: root.resetRequested()
        }
    }
}

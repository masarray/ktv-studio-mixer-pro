import QtQuick
import QtQuick.Layouts

StudioPanel {
    id: root
    required property var engine
    implicitHeight: 286
    accentTop: true

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 11
        spacing: 7
        Text {
            Layout.fillWidth: true
            Layout.preferredHeight: 16
            text: "MUSIC INPUT"
            verticalAlignment: Text.AlignVCenter
            color: Theme.text
            font.family: Theme.fontFamily
            font.pixelSize: 9
            font.weight: Font.Bold
            font.letterSpacing: 0.7
        }
        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; Layout.minimumHeight: 1; Layout.maximumHeight: 1; color: Theme.borderSoft }
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "IN 1"; value: root.engine.input1Gain; onValueEdited: function(v) { root.engine.input1Gain = v }; accentColor: Theme.blue }
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "IN 2"; value: root.engine.input2Gain; onValueEdited: function(v) { root.engine.input2Gain = v }; accentColor: Theme.blue }
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "BT"; value: root.engine.bluetoothGain; onValueEdited: function(v) { root.engine.bluetoothGain = v }; active: true; accentColor: Theme.accent }
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "UDISK"; value: root.engine.uDiskGain; onValueEdited: function(v) { root.engine.uDiskGain = v }; accentColor: Theme.violet }
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "DIG"; value: root.engine.digitalGain; onValueEdited: function(v) { root.engine.digitalGain = v }; accentColor: Theme.amber }
        }
    }
}

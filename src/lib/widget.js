// Sends the widget snapshot (domain/widget.js) to the Android home-screen
// widget. The native half is TallyWidget.java / TallyWidgetBridge.java in
// the Android project. Everywhere else -- the browser, iOS for now -- there
// is no widget, and this quietly does nothing.

import { Capacitor, registerPlugin } from '@capacitor/core';

const TallyWidget = registerPlugin('TallyWidget');

export function widgetAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export async function pushWidget(snapshot) {
  if (!widgetAvailable()) return;
  await TallyWidget.update({ snapshot: JSON.stringify(snapshot) });
}

/** Whether the launcher can place the widget when asked. */
export async function canPinWidget() {
  if (!widgetAvailable()) return false;
  try {
    return (await TallyWidget.canPin()).value === true;
  } catch {
    return false;
  }
}

/** Ask the launcher to place the widget; it confirms with the user itself. */
export async function pinWidget() {
  await TallyWidget.pin();
}

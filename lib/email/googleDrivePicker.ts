/**
 * Client-only loader for the Google Picker widget, used by the composer's "Insert from Drive"
 * button. The Picker JS API has no npm package or official type definitions — Google serves it
 * from a script tag and hangs `google.picker` off `window` once `gapi.load("picker", ...)`
 * resolves, so the shapes below are hand-trimmed to just what this file touches.
 */

type PickerDoc = { id: string; name: string; url: string; mimeType: string; iconUrl: string };
type PickerResponse = { action: string; docs?: PickerDoc[] };
type PickerView = { setIncludeFolders: (include: boolean) => PickerView };
type PickerInstance = { setVisible: (visible: boolean) => void };
type PickerBuilder = {
  addView: (view: PickerView) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setCallback: (callback: (data: PickerResponse) => void) => PickerBuilder;
  build: () => PickerInstance;
};
type GooglePicker = {
  DocsView: new (viewId: string) => PickerView;
  ViewId: { DOCS: string };
  Action: { PICKED: string; CANCEL: string };
  PickerBuilder: new () => PickerBuilder;
};

declare global {
  interface Window {
    gapi?: { load: (api: string, callback: () => void) => void };
    google?: { picker: GooglePicker };
  }
}

let gapiScriptPromise: Promise<void> | null = null;
let pickerLoadPromise: Promise<void> | null = null;

function loadGapiScript(): Promise<void> {
  if (gapiScriptPromise) return gapiScriptPromise;
  gapiScriptPromise = new Promise((resolve, reject) => {
    if (window.gapi) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google API script."));
    document.head.appendChild(script);
  });
  return gapiScriptPromise;
}

async function ensurePickerLoaded(): Promise<void> {
  if (pickerLoadPromise) return pickerLoadPromise;
  pickerLoadPromise = loadGapiScript().then(
    () =>
      new Promise((resolve) => {
        window.gapi!.load("picker", () => resolve());
      })
  );
  return pickerLoadPromise;
}

export type DrivePickedFile = PickerDoc;

/**
 * Open the Picker for a single file, scoped to the given Drive access token. Resolves with the
 * picked file, or `null` if the user cancels.
 */
export async function openGoogleDrivePicker(
  accessToken: string,
  developerKey: string
): Promise<DrivePickedFile | null> {
  await ensurePickerLoaded();
  const picker = window.google!.picker;

  return new Promise((resolve, reject) => {
    try {
      const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(false);
      const builder = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(developerKey)
        .setCallback((data: PickerResponse) => {
          if (data.action === picker.Action.PICKED) {
            const doc = data.docs?.[0];
            resolve(doc ?? null);
          } else if (data.action === picker.Action.CANCEL) {
            resolve(null);
          }
        });
      builder.build().setVisible(true);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Failed to open Google Picker."));
    }
  });
}

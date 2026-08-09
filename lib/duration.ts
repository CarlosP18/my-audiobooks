// Reads an audio file's duration client-side via a hidden <audio> element
// and the loadedmetadata event — the browser's native decoder handles
// mp3/m4a/m4b container parsing, so no per-format logic is needed.
//
// Rejects (rather than resolving a fallback value) on the `error` event:
// per 02-UI-SPEC.md's "Duration-read-failure resolution", an unreadable
// duration is a failed import, never a stored record with an unknown
// duration. The object URL is revoked on both the success and failure
// paths so it never leaks.
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.src = url;
    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read audio metadata"));
    });
  });
}

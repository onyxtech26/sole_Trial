/* The trial has no file storage: uploads are kept inline as data URLs in the
   browser's localStorage, which holds about 5 MB in all. */

const MAX_BYTES = 500 * 1024;

export async function uploadFile(_folder: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('The trial accepts files up to 500 KB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/** Inline files disappear with the record that holds them. */
export async function removeUpload(_url: string): Promise<void> {}

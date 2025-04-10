/**
 * Reads a file and returns it as a base64 string with appropriate MIME type
 * @param file The file to read
 * @returns Promise resolving to a base64 string with MIME type prefix
 */
export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // The result already contains the correct MIME type from the File object
      const base64String = reader.result as string;
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};

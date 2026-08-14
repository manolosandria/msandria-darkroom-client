'use client';

export default function UploadPanel() {

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <h1 className="text-4xl font-bold mb-4">Upload your photos</h1>
            <p className="text-lg text-gray-600 mb-8">Select a photo to upload to the gallery.</p>
            <input type="file" accept="image/*" className="mb-4" />
            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300">
                Upload
            </button>
        </div>
    );
}
"use client";
import { BASE_URL, CLOUDFRONT_URL } from "@/utils";
import axios from "axios";
import Image from "next/image";
import React, { ChangeEvent, useState } from "react";


export function UploadImage({
  onImageAdded,
  image,
}: {
  onImageAdded: (image: string) => void;
  image?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onFileSelect(e: ChangeEvent<HTMLInputElement>) {
    try {
      setError(null);
      setUploading(true);

      if (!e.target.files?.length) {
        throw new Error("No file selected");
      }

      const file = e.target.files[0];

      // Create preview URL
      setPreview(URL.createObjectURL(file));

      const response = await axios.get(`${BASE_URL}/v1/user/presignedUrl`, {
        headers: {
          Authorization: localStorage.getItem("token") || "",
        },
      });

      const presignedData = response.data;
      const formData = new FormData();

      Object.entries(presignedData.fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });

      formData.append("file", file);

      await axios.post(presignedData.preSignedUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Make sure to include the leading slash in the URL construction
      const imageUrl = `${CLOUDFRONT_URL}/${presignedData.fields.key}`;
      onImageAdded(imageUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  // Cleanup preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  if (image) {
    return (
      <div className="relative w-[20rem] h-56  ">
        <Image
          src={image}
          alt="Uploaded image"
          fill
          className="object-cover rounded p-2"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="w-40 h-40 rounded border border-gray-300">
        <div className="h-full flex justify-center items-center relative">
          {uploading ? (
            <div className="text-sm text-gray-600">Uploading...</div>
          ) 
          : (
            <div className="text-center">
              <div className="text-4xl text-gray-400">+</div>
              <div className="text-sm text-gray-500">Upload Image</div>
            </div>
          )}
          <input
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            type="file"
            accept="image/*"
            onChange={onFileSelect}
            disabled={uploading}
          />
        </div>
      </div>
      {error && <div className="mt-2 text-sm text-red-500">{error}</div>}
    </div>
  );
}
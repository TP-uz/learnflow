import { useState } from 'react';
import axios from 'axios';
import { CircularProgress, IconButton } from '@mui/material';
import { AttachFile, CheckCircle, Error } from '@mui/icons-material';

const FileUpload = ({ noteId, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    if (e.target.files[0].size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `/api/notes/${noteId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        }
      );

      onUploadComplete?.({
        url: response.data.fileUrl,
        name: file.name,
        type: file.type
      });
      
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="file-upload-container">
      <input
        accept=".pdf,.doc,.docx,.jpg,.png"
        style={{ display: 'none' }}
        id={`file-upload-${noteId}`}
        type="file"
        onChange={handleFileChange}
      />
      
      <label htmlFor={`file-upload-${noteId}`}>
        <IconButton component="span" disabled={isUploading}>
          <AttachFile />
        </IconButton>
      </label>

      {file && (
        <div className="file-info">
          <span>{file.name}</span>
          {!isUploading ? (
            <IconButton onClick={handleUpload} color="primary">
              <CheckCircle />
            </IconButton>
          ) : (
            <CircularProgress variant="determinate" value={progress} size={24} />
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          <Error color="error" fontSize="small" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
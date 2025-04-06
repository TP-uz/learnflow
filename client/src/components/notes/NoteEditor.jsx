// Inside NoteEditor.jsx
import FileUpload from './FileUpload';

const NoteEditor = ({ note }) => {
  const [attachments, setAttachments] = useState(note?.attachments || []);

  const handleUploadComplete = (newFile) => {
    setAttachments([...attachments, newFile]);
  };

  return (
    <div>
      {/* Existing editor content */}
      <FileUpload 
        noteId={note._id} 
        onUploadComplete={handleUploadComplete}
      />
      
      <div className="attachments-list">
        {attachments.map((file, index) => (
          <a 
            key={index} 
            href={file.url} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            {file.name}
          </a>
        ))}
      </div>
    </div>
  );
};
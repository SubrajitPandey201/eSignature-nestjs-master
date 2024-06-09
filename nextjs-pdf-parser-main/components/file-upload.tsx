'use client';
import { FilePond, registerPlugin } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import { useState } from 'react';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';
import FilePondPluginFileEncode from 'filepond-plugin-file-encode';

// Register the plugins
registerPlugin(FilePondPluginFileValidateType, FilePondPluginFileEncode);

export default function FileUpload() {
  const [parsedText, setParsedText] = useState('');
  const [signUrl, setSignUrl] = useState('');

  const handleProcess = (
    fieldName: string,
    file: Blob,
    metadata: any,
    load: (arg0: string) => void,
    error: (arg0: string) => void,
    progress: any,
    abort: () => void,
  ) => {
    const formData = new FormData();
    formData.append(fieldName, file, file.name);

    fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.text())
      .then((text) => {
        setParsedText(text);
        const signUrlMatch = text.match(/E-Sign URL: (.*)/);
        if (signUrlMatch) {
          setSignUrl(signUrlMatch[1]);
        }
        load(text);
      })
      .catch((err) => {
        console.error(err);
        error('Oh no, something went wrong');
      });

    return {
      abort: () => {
        abort();
      },
    };
  };

  return (
    <div>
      <FilePond
        allowMultiple={false}
        maxFiles={1}
        acceptedFileTypes={['application/pdf']}
        server={{ process: handleProcess }}
      />
      <div>
        <h2>Parsed Text:</h2>
        <pre>{parsedText}</pre>
        {signUrl && (
          <div>
            <h2>E-Sign URL:</h2>
            <a href={signUrl} target="_blank" rel="noopener noreferrer">
              {signUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import PDFParser from 'pdf2json';
import axios from 'axios';

const ZOHO_ESIGN_API_URL = 'https://sign.zoho.com/api/v1';
const ZOHO_ACCESS_TOKEN = 'your_zoho_access_token'; // Replace with your Zoho access token

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const uploadedFiles = formData.getAll('filepond');
  let fileName = '';
  let parsedText = '';

  if (uploadedFiles && uploadedFiles.length > 0) {
    const uploadedFile = uploadedFiles[0]; // Use the correct index

    if (uploadedFile instanceof File) {
      fileName = uuidv4();
      const tempFilePath = `/tmp/${fileName}.pdf`;
      const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
      await fs.writeFile(tempFilePath, fileBuffer);

      const pdfParser = new PDFParser();

      parsedText = await new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', (errData: any) => {
          console.error(errData.parserError);
          reject(errData.parserError);
        });

        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          const rawText = extractTextFromPDFData(pdfData);
          resolve(rawText);
        });

        pdfParser.loadPDF(tempFilePath);
      });

      await fs.unlink(tempFilePath); // Clean up temporary file

      // Send the file to Zoho eSign for e-signing
      const eSignResponse = await sendToZohoESign(fileBuffer, fileName);
      if (eSignResponse.success) {
        parsedText += `\n\nE-Sign URL: ${eSignResponse.signUrl}`;
      } else {
        console.error('Error sending to Zoho eSign:', eSignResponse.error);
      }
    } else {
      console.error('Uploaded file is not in the expected format.');
    }
  } else {
    console.error('No files found.');
  }

  const response = new NextResponse(parsedText);
  response.headers.set('FileName', fileName);
  return response;
}

function extractTextFromPDFData(pdfData: any): string {
  const pages = pdfData.formImage.Pages;
  let rawText = '';

  pages.forEach((page: any) => {
    page.Texts.forEach((text: any) => {
      text.R.forEach((textRun: any) => {
        rawText += decodeURIComponent(textRun.T);
      });
      rawText += '\n';
    });
  });

  return rawText;
}

async function sendToZohoESign(fileBuffer: Buffer, fileName: string) {
  try {
    const response = await axios.post(
      `${ZOHO_ESIGN_API_URL}/requests`,
      {
        requests: [
          {
            action_type: 'SIGN',
            request_name: 'Document Signing',
            email: 'recipient@example.com',
            file_name: `${fileName}.pdf`,
            file_data: fileBuffer.toString('base64'),
            signing_order: 1,
            signers: [
              {
                email: 'recipient@example.com',
                action_type: 'SIGN',
                recipient_name: 'John Doe',
                in_person_name: '',
                private_notes: '',
              },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      success: true,
      signUrl: response.data.sign_url,
    };
  } catch (err: unknown) {
    // Change `error` to `err` and type it as `unknown`
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import pkg from 'pdf-parse/lib/pdf-parse.js';
const pdfParse = pkg;

const s3 = new S3Client({ region: "ap-south-1" });

export const handler = async (event) => {
  
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  
  console.log(`Processing file: ${key} from bucket: ${bucket}`);
  
  try {
    // Step 1: Download the PDF from S3
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const s3Response = await s3.send(getCommand);
    
    // Convert stream to buffer
    const pdfBuffer = await streamToBuffer(s3Response.Body);
    
    console.log(`PDF downloaded, size: ${pdfBuffer.length} bytes`);
    
    // Step 2: Parse the PDF using pdf-parse library
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;
    
    console.log(`Extracted ${extractedText.length} characters`);
    console.log("Text preview:", extractedText.substring(0, 200));
    
    // Step 3: Save the extracted text to processed/ folder
    const fileName = key.split("/").pop().replace(".pdf", "");
    const outputKey = `processed/${fileName}.txt`;
    
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      Body: extractedText,
      ContentType: "text/plain"
    });
    
    await s3.send(putCommand);
    
    console.log(`✅ Text saved to: ${outputKey}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Extraction successful",
        outputFile: outputKey,
        characterCount: extractedText.length
      })
    };
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
};

// Helper function to convert stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
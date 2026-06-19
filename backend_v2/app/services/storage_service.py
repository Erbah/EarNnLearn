import os
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
import uuid
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        # Default to local mock implementation if credentials are missing
        self.use_s3 = bool(getattr(settings, 'AWS_ACCESS_KEY_ID', None) and getattr(settings, 'AWS_SECRET_ACCESS_KEY', None))
        
        if self.use_s3:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_REGION', 'us-east-1'),
                endpoint_url=getattr(settings, 'S3_ENDPOINT_URL', None) # Useful for Cloudflare R2 or MinIO
            )
            self.bucket_name = getattr(settings, 'S3_BUCKET_NAME', 'learnnearn-bucket')
        else:
            # Fallback to local storage for local dev / testing if S3 is not configured
            self.local_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads", "knowledge")
            os.makedirs(self.local_dir, exist_ok=True)
            
        self.cdn_domain = getattr(settings, 'CDN_DOMAIN', None)
            
    async def upload_file(self, file: UploadFile, folder: str = "knowledge") -> str:
        """
        Uploads a file to S3 (or locally if S3 is unconfigured) and returns the public or reference URL.
        """
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{folder}/{uuid.uuid4().hex}{file_ext}"
        
        if self.use_s3:
            try:
                # Read file into memory (or stream it)
                file_content = await file.read()
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=unique_filename,
                    Body=file_content,
                    ContentType=file.content_type
                )
                
                # By default, we want to return the raw file_key to store in the DB,
                # but to avoid breaking existing legacy code that expects a full URL back,
                # we return the public URL. Future endpoints should parse this or store just the key.
                return self.get_public_url(unique_filename)
            except ClientError as e:
                logger.error(f"S3 Upload failed: {e}")
                raise Exception(f"S3 Upload failed: {e}")
            finally:
                # Reset file cursor if it needs to be read again
                await file.seek(0)
        else:
            # Local Fallback
            local_path = os.path.join(self.local_dir, os.path.basename(unique_filename))
            with open(local_path, "wb") as buffer:
                buffer.write(await file.read())
            await file.seek(0)
            return self.get_public_url(unique_filename)

    def get_public_url(self, file_key: str) -> str:
        """
        Returns a public CDN URL if configured, otherwise returns the raw S3 URL or local path.
        If the file_key is already a full URL (legacy), it returns it as-is.
        """
        if file_key.startswith("http://") or file_key.startswith("https://"):
            return file_key
            
        if self.use_s3:
            if self.cdn_domain:
                # Strip leading slashes to prevent double slashes
                clean_key = file_key.lstrip("/")
                return f"https://{self.cdn_domain}/{clean_key}"
            region = getattr(settings, 'AWS_REGION', 'us-east-1')
            return f"https://{self.bucket_name}.s3.{region}.amazonaws.com/{file_key}"
        else:
            return os.path.join(self.local_dir, os.path.basename(file_key))

    def get_presigned_url(self, file_key: str, expires_in: int = 3600) -> str:
        """
        Generates a secure, temporary pre-signed URL for protected assets.
        If CDN_DOMAIN is used and configured with CloudFront signed URLs, this logic 
        would be updated to generate CloudFront signatures. For now, it falls back to S3 presigned URLs.
        If S3 is not configured (local dev), returns the local path.
        """
        # If legacy full URL is passed, we can't reliably sign it without extracting the key.
        if file_key.startswith("http://") or file_key.startswith("https://"):
            if "amazonaws.com/" in file_key:
                file_key = file_key.split("amazonaws.com/")[1]
            elif self.cdn_domain and self.cdn_domain in file_key:
                file_key = file_key.split(f"{self.cdn_domain}/")[1]
            else:
                return file_key # Can't sign external URLs
                
        if self.use_s3:
            try:
                url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket_name, 'Key': file_key},
                    ExpiresIn=expires_in
                )
                return url
            except ClientError as e:
                logger.error(f"Failed to generate presigned URL: {e}")
                return self.get_public_url(file_key) # Fallback to public
        else:
            return self.get_public_url(file_key)

storage_service = StorageService()

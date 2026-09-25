import { Global, Module } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseJwtVerifierService } from './supabase-jwt-verifier.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Global()
@Module({
  providers: [SupabaseStorageService, SupabaseAuthService, SupabaseJwtVerifierService],
  exports: [SupabaseStorageService, SupabaseAuthService, SupabaseJwtVerifierService],
})
export class SupabaseModule {}

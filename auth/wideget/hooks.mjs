// This file belongs to Yapp after Login Kit init.
// Do not put domain-record migration, billing-ledger mutation, or provider
// credentials in the shared kit.

import { YAPP_APP_ID } from './adapter.mjs';

export const appIdentityHooks = {
  async onIdentityVerified({ identity, correlationId }) {
    return {
      appId: YAPP_APP_ID,
      disposition: 'no_op',
      subject: identity.subject,
      appUserId: identity.appUserId ?? null,
      correlationId
    };
  },

  async onIdentityLinkConflict({ identity, candidateSubject, correlationId }) {
    return {
      appId: YAPP_APP_ID,
      disposition: 'require_user_action',
      code: 'IDENTITY_LINK_CONFLICT',
      subject: identity.subject,
      candidateSubject,
      correlationId
    };
  },

  async onDeletionRequested({ identity, correlationId }) {
    return {
      appId: YAPP_APP_ID,
      disposition: 'app_owned_reconciliation_required',
      subject: identity.subject,
      correlationId
    };
  },

  async onTrialConversion({ identity, sourceRecordIds, correlationId }) {
    return {
      appId: YAPP_APP_ID,
      disposition: 'app_owned_idempotent_reconciliation_required',
      subject: identity.subject,
      appUserId: identity.appUserId ?? null,
      sourceRecordIds: Array.isArray(sourceRecordIds) ? [...sourceRecordIds] : [],
      correlationId
    };
  }
};

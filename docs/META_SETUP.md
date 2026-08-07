# Meta Page integration

Meta changes versions and review requirements, so confirm the selected Graph version in the official developer dashboard before going live. The code makes the version configurable with `META_GRAPH_VERSION` and uses Page `/feed` and `/photos` publishing server-side.

1. Create a Meta Developer app suitable for a business integration and add Facebook Login.
2. Add the exact `META_REDIRECT_URI` as a valid OAuth redirect URI. Add the production domain and provide public privacy-policy and data-deletion callback/instructions URLs.
3. Request `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`. Keep only permissions used by Rudder.
4. Configure development mode first. Use app-role test users and a dedicated test Page. Non-role users require Live mode, App Review, and potentially Business Verification.
5. Add `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, redirect URI, and Graph version to the server environment. `META_CONFIG_ID` is the Facebook Login for Business configuration that contains the required Page permissions. Generate `TOKEN_ENCRYPTION_KEY` with 32 random bytes encoded as base64.
6. In **Facebook Pages**, connect Meta. Rudder validates a single-use OAuth state, exchanges the code server-side, lists managed Pages, encrypts Page tokens, and stores permission metadata.
7. Create a harmless test post, verify it on the test Page, and use the test deletion action where permitted.

Never expose the App Secret or Page token to the browser. Reauthorise when Meta reports expiry or revoked permissions. Disconnecting clears the encrypted token and disables the connection. Current official references: [Page posts](https://developers.facebook.com/docs/pages-api/posts/), [access tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/), and [manual login flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/).

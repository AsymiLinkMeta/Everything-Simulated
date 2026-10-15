/*
# Restrict convert_quote_to_order to authenticated only

The function already checks is_staff() internally, but the EXECUTE grant
should not include anon. This revokes anon access explicitly.
*/

REVOKE EXECUTE ON FUNCTION convert_quote_to_order(text) FROM anon;

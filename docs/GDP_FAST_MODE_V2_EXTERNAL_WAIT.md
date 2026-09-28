# FAST MODE external wait handling

If the only blocker is an external provider process such as deployment propagation, do not invent code changes. Confirm all controllable checks are green, identify the external wait explicitly, and resume verification as soon as the provider result is available.

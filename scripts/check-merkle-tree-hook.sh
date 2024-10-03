#!/bin/bash

# Change directory to repo root
cd "$(dirname "$0")/.." || exit 1

for chain_dir in chains/*/; do
    chain_name=$(basename "$chain_dir")

    # If arguments are provided, only process the chains listed in the arguments
    if [ "$#" -gt 0 ] && [[ ! " $@ " =~ " $chain_name " ]]; then
        continue
    fi

    metadata_file="$chain_dir/metadata.yaml"
    addresses_file="$chain_dir/addresses.yaml"

    # Check if addresses.yaml exists
    if [ ! -f "$addresses_file" ]; then
        echo "$chain_name: No addresses found, skipping."
        continue
    fi

    # Extract values from addresses.yaml and metadata.yaml in one call
    read -r merkle_tree_hook protocol rpc_url mailbox < <(
        yq e '.merkleTreeHook, .protocol, .rpcUrls[0].http, .mailbox' "$addresses_file" "$metadata_file"
    )

    # Check if merkleTreeHook exists
    if [ "$merkle_tree_hook" = "null" ] || [ -z "$merkle_tree_hook" ]; then
        echo "$chain_name: No address for merkleTreeHook, skipping."
        continue
    fi

    # Check if chain is EVM (Ethereum-based)
    if [ "$protocol" != "ethereum" ]; then
        echo "$chain_name: Not EVM, skipping."
        continue
    fi

    # Ensure RPC URL and mailbox exist
    if [ -z "$rpc_url" ]; then
        echo "$chain_name: No RPC URL found, skipping."
        continue
    fi

    if [ -z "$mailbox" ]; then
        echo "$chain_name: No mailbox address found, skipping."
        continue
    fi

    # Get the defaultHook using cast
    default_hook=$(cast call "$mailbox" 'defaultHook()' --rpc-url "$rpc_url" 2>/dev/null)
    if [ -z "$default_hook" ]; then
        echo "$chain_name: Error calling defaultHook, skipping."
        continue
    fi

    # Truncate the default_hook to the last 40 characters (20 bytes)
    truncated_hook=${default_hook: -40}

    # Call fallbackHook using the truncated default_hook
    fallback_hook=$(cast call "0x$truncated_hook" 'fallbackHook()' --rpc-url "$rpc_url" 2>/dev/null)
    if [ -z "$fallback_hook" ]; then
        echo "$chain_name: Error calling fallbackHook, skipping."
        continue
    fi

    # Normalize addresses
    normalized_fallback_hook=$(echo "$fallback_hook" | sed 's/^0x//' | awk '{print tolower(sprintf("%040s", $0))}')
    normalized_merkle_tree_hook=$(echo "$merkle_tree_hook" | sed 's/^0x//' | awk '{print tolower(sprintf("%040s", $0))}')

    # Compare normalized addresses
    if [ "$normalized_fallback_hook" == "$normalized_merkle_tree_hook" ]; then
        echo "$chain_name: fallbackHook matches merkleTreeHook"
    else
        echo "$chain_name: Mismatch - fallbackHook: $normalized_fallback_hook, merkleTreeHook: $normalized_merkle_tree_hook"
        # Uncomment to update the merkleTreeHook in addresses.yaml
        # yq e -i ".merkleTreeHook = \"$fallback_hook\"" "$addresses_file"
        # echo "$chain_name: Updated merkleTreeHook in addresses.yaml"
    fi
done

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/claim.json`.
 */
export type Claim = {
  "address": "7jd5qzcXeDhppUbjycdE9FtZG46E4XQ69mwsns5gjYNW",
  "metadata": {
    "name": "claim",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "ixSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "emergencyWithdrawal",
      "discriminator": [
        155,
        226,
        43,
        211,
        1,
        50,
        84,
        156
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "globalState"
          ]
        },
        {
          "name": "globalState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          },
          "relations": [
            "globalState"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initGlobal",
      "discriminator": [
        44,
        238,
        77,
        253,
        76,
        182,
        192,
        162
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "backendAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateGlobal",
      "discriminator": [
        90,
        152,
        240,
        21,
        199,
        38,
        72,
        20
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "globalState"
          ]
        },
        {
          "name": "globalState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "updateGlobalConfigArgs"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalState",
      "discriminator": [
        163,
        46,
        74,
        168,
        216,
        123,
        133,
        98
      ]
    },
    {
      "name": "userState",
      "discriminator": [
        72,
        177,
        85,
        249,
        76,
        167,
        186,
        126
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "sigVerificationFailed",
      "msg": "Signature verification failed"
    },
    {
      "code": 6001,
      "name": "claimSuspended",
      "msg": "Claim on pause"
    },
    {
      "code": 6002,
      "name": "excessLimit",
      "msg": "The daily claim limit has been exceeded"
    },
    {
      "code": 6003,
      "name": "claimLimit",
      "msg": "Your daily claim limit has been exceeded"
    },
    {
      "code": 6004,
      "name": "signerChangingDelay",
      "msg": "Changing this authority is not possible until the expiration date"
    }
  ],
  "types": [
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "pause",
            "type": "bool"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "backendAuthority",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "dailyLimit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "today",
            "type": "i64"
          },
          {
            "name": "todayTotal",
            "type": "u64"
          },
          {
            "name": "claimRequestsLimit",
            "type": {
              "option": "u8"
            }
          }
        ]
      }
    },
    {
      "name": "updateGlobalConfigArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pause",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "authority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "backendAuthority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "dailyLimit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "claimRequestsLimit",
            "type": {
              "option": "u8"
            }
          }
        ]
      }
    },
    {
      "name": "userState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "claimedTotal",
            "type": "u64"
          },
          {
            "name": "today",
            "type": "i64"
          },
          {
            "name": "todayClaimCount",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

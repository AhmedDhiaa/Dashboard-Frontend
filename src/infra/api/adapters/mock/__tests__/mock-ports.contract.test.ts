import { runAuthPortContract, runEnumPortContract } from "@/shared/test-utils/port-contracts"
import { mockAuthPort } from "../auth.adapter"
import { mockEnumPort } from "../enum.adapter"

// The standalone-mode adapters must satisfy the same neutral port contracts the
// real ABP adapters do — this is what keeps mock mode a faithful stand-in.
runAuthPortContract("mock", () => mockAuthPort)
runEnumPortContract("mock", () => mockEnumPort)

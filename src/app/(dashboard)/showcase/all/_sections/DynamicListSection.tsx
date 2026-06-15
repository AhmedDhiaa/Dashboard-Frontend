"use client"

/**
 * DynamicListSection — the row editor (DynamicListField): add / remove / reorder
 * rows of typed fields inside a form. This is what powers invoice line-items,
 * order lines, stock entries, etc. Wrapped in a minimal react-hook-form context
 * (the field uses useFieldArray + useFormContext).
 */

import { useForm } from "react-hook-form"
import { Form } from "@/ui/design-system/primitives/form"
import { DynamicListField } from "@/core/crud/components/DynamicListField"
import ShowcaseBlock from "../_shared/ShowcaseBlock"

interface DemoForm {
  items: Array<Record<string, unknown>>
}

export default function DynamicListSection() {
  const form = useForm<DemoForm>({
    defaultValues: {
      items: [
        { product: "Diesel 10L", qty: 3, price: 12000, taxable: true },
        { product: "Filter kit", qty: 1, price: 25000, taxable: false },
      ],
    },
  })

  return (
    <ShowcaseBlock
      title="Dynamic list / row editor"
      description="DynamicListField — add, remove and edit rows of typed fields inside a form (invoice items, order lines, stock entries…)."
    >
      <Form {...form}>
        <DynamicListField
          name="items"
          label="Invoice items"
          description="Add or remove line items."
          layout="table"
          addButtonLabel="Add item"
          emptyMessage="No items yet."
          defaultRowValue={{ product: "", qty: 1, price: 0, taxable: false }}
          columns={[
            { name: "product", label: "Product", type: "text", placeholder: "Item name", required: true },
            { name: "qty", label: "Qty", type: "number", width: "90px" },
            { name: "price", label: "Price (IQD)", type: "number" },
            { name: "taxable", label: "Taxable", type: "boolean", width: "90px" },
          ]}
        />
      </Form>
    </ShowcaseBlock>
  )
}

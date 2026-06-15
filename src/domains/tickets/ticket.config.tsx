/**
 * Ticket Entity Configuration
 */

import { MessageSquare, CheckCircle } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import type { EntityConfig } from "@/core/entities/config-types"
import { createPrimaryInfoSection, createMetadataSection } from "@/core/crud/components/BaseDetailRenderer"
import { ticketService } from "./ticket.service"
import type { Ticket, CreateTicketRequest } from "./types"
import { getTicketCreateSchema, getTicketUpdateSchema } from "@/domains/tickets/ticket.schema"

export const ticketConfig: EntityConfig<Ticket, CreateTicketRequest> = {
  entityName: "ticket",
  singularName: "Ticket",
  pluralName: "Tickets",
  icon: MessageSquare,
  service: ticketService,
  permissionKey: "Api.Ticket",
  basePath: "/tickets",
  routes: {
    create: "/tickets/create",
  },

  listColumns: [
    { field: "reference", type: "badge-code" },
    { field: "title", type: "text-primary" },
    {
      field: "userInfo.entity.name",
      type: "text-primary",
      titleKey: "pages_tickets.tickets.fields.userInfo",
    },
    { field: "date", type: "datetime" },
    { field: "status", type: "enum", config: { enumType: "ticket-status" } },
    {
      field: "id",
      id: "quick-actions",
      titleKey: "crud.actions.title",
      type: "custom",
      config: {
        customRender: (_id: unknown, ticket: Ticket) => (
          <div className="flex items-center gap-1">
            {(ticket as Ticket).status !== 2 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-success hover:bg-success/10 rounded-lg"
                onClick={e => {
                  e.stopPropagation()
                  window.dispatchEvent(
                    new CustomEvent("ticket:action", {
                      detail: { action: "close", ticket },
                    }),
                  )
                }}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      },
    },
  ],

  filterFields: [
    {
      name: "Status",
      type: "multi-select",
      label: "common.fields.status",
      enumType: "ticket-status",
    },
    {
      name: "DateFrom",
      type: "date",
      label: "common.from",
    },
    {
      name: "DateTo",
      type: "date",
      label: "common.to",
    },
  ],

  defaultSort: { field: "date", direction: "desc" },
  searchFields: ["reference", "title", "userInfo.entity.name"],
  defaultPageSize: 15,

  detailSections: [
    createPrimaryInfoSection([
      { name: "reference", type: "badge-code" },
      { name: "title", type: "text-primary" },
      { name: "status", type: "enum", config: { enumType: "ticket-status" } },
      {
        name: "userInfo.entity.name",
        type: "text-primary",
        labelKey: "pages_tickets.tickets.fields.userInfo",
      },
    ]),
    createMetadataSection(),
  ],

  formFields: {
    title: {
      type: "text",
      labelKey: "pages_tickets.tickets.fields.title",
      required: true,
    },
    "userInfo.id": {
      type: "autocomplete",
      labelKey: "pages_tickets.tickets.fields.userInfo",
      required: true,
      entityName: "business-partner",
      customEndpoint: "/api/app/business-partner/customer-autocomplete",
    },
    status: {
      type: "enum",
      enumType: "ticket-status",
      labelKey: "common.fields.status",
    },
    note: {
      type: "textarea",
      labelKey: "pages_tickets.tickets.fields.note",
      rows: 4,
    },
    concurrencyStamp: {
      type: "text",
      hidden: true,
    },
  },

  formFieldOrder: ["title", "userInfo.id", "status", "note"],
  excludeFields: ["concurrencyStamp"],

  createSchema: getTicketCreateSchema,
  updateSchema: getTicketUpdateSchema,

  defaultFormValues: {
    title: "",
    status: 0,
    note: "",
    userInfo: { id: "" },
  },

  entityToFormData: (ticket: Ticket) => ({
    title: ticket.title,
    status: ticket.status,
    note: ticket.note || "",
    userInfo: ticket.userInfo ? { id: ticket.userInfo.id } : { id: "" },
    concurrencyStamp: ticket.concurrencyStamp,
  }),

  translations: {
    listTitle: "dashboard.categories.tickets",
    listDescription: "pages_tickets.tickets.subtitle",
    detailTitle: "pages_tickets.tickets.detail.title",
    createTitle: "pages_tickets.tickets.new_ticket",
    editTitle: "pages_tickets.tickets.edit_ticket",
    searchPlaceholder: "pages_tickets.tickets.searchPlaceholder",
  },

  features: {
    create: true,
    edit: true,
    delete: true,
    view: true,
    export: true,
  },
}

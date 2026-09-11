import { ParticipantsEditor } from "@/components/ParticipantsEditor";

interface Props {
  /** The print view passes true to render a plain table without inputs. */
  readOnly?: boolean;
}

/** MDX block `<ParticipantsList />` — the shared participant list on a slide (e.g. 00.04). */
export function ParticipantsList({ readOnly = false }: Props) {
  return <ParticipantsEditor readOnly={readOnly} />;
}

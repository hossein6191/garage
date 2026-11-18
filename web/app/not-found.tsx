import { ButtonLink } from "@/components/button";

export default function NotFound() {
  return (
    <div className="sheet hook mx-auto max-w-lg px-5 pt-7 pb-5 text-center">
      <p className="stamp stamp-not text-[26px]">No such card</p>
      <p className="mt-4 text-ink-2">Nothing is filed under this address.</p>
      <div className="mt-4">
        <ButtonLink href="/">Back to the start</ButtonLink>
      </div>
    </div>
  );
}

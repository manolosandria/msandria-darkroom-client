"use client";
import MainHeader from "@/src/ui/components/MainHeader";
import EmailSignIn from "@/src/ui/components/EmailSignIn";
import { signInByEmail } from "@/src/infrastructure/sessionServices";

const ports = {
  request: (email: string) => signInByEmail.request(email),
  verify: (email: string, code: string) => signInByEmail.verify(email, code),
};

export default function EmailSignInPage() {
  return (
    <>
      <MainHeader />
      <EmailSignIn ports={ports} />
    </>
  );
}

"use server";

import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/db";
import { appointmentsTable, doctorsTable, patientsTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { actionClient } from "@/lib/next-safe-action";
import { sendWhatsApp } from "@/lib/whatsapp";

import { getAvailableTimes } from "../get-available-times";
import { addAppointmentSchema } from "./schema";

export const addAppointment = actionClient
  .schema(addAppointmentSchema)
  .action(async ({ parsedInput }) => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      throw new Error("Unauthorized");
    }
    if (!session?.user.clinic?.id) {
      throw new Error("Clinic not found");
    }
    const clinicId = session.user.clinic.id;
    const [doctor, patient] = await Promise.all([
      db.query.doctorsTable.findFirst({
        where: and(
          eq(doctorsTable.id, parsedInput.doctorId),
          eq(doctorsTable.clinicId, clinicId),
        ),
      }),
      db.query.patientsTable.findFirst({
        where: and(
          eq(patientsTable.id, parsedInput.patientId),
          eq(patientsTable.clinicId, clinicId),
        ),
      }),
    ]);
    if (!doctor || !patient) {
      throw new Error("Registro não encontrado");
    }
    const availableTimes = await getAvailableTimes({
      doctorId: parsedInput.doctorId,
      date: dayjs(parsedInput.date).format("YYYY-MM-DD"),
    });
    if (!availableTimes?.data) {
      throw new Error("No available times");
    }
    const isTimeAvailable = availableTimes.data?.some(
      (time) => time.value === parsedInput.time && time.available,
    );
    if (!isTimeAvailable) {
      throw new Error("Time not available");
    }
    const appointmentDateTime = dayjs(parsedInput.date)
      .set("hour", parseInt(parsedInput.time.split(":")[0]))
      .set("minute", parseInt(parsedInput.time.split(":")[1]))
      .toDate();
    if (appointmentDateTime <= new Date()) {
      throw new Error("Horário já passou");
    }

    await db.insert(appointmentsTable).values({
      ...parsedInput,
      clinicId: session?.user.clinic?.id,
      date: appointmentDateTime,
    });

    if (process.env.WHATSAPP_TEST_NUMBER) {
      await sendWhatsApp(
        process.env.WHATSAPP_TEST_NUMBER,
        `Agendamento registrado para ${dayjs(appointmentDateTime).format("DD/MM/YYYY [às] HH:mm")}. Consulte o sistema.`,
      );
    }

    revalidatePath("/appointments");
    revalidatePath("/dashboard");
  });

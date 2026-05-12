# ScanHemat Agent Instructions

## Project Overview

ScanHemat is a personal finance web app that helps users record expenses automatically from receipt photos using OCR. Users upload a receipt image, the system extracts transaction data, the user reviews and corrects the result, then saves it into a budgeting dashboard.

## Language Rules

- Use English for code, folder names, file names, database models, API routes, functions, variables, comments, and technical documentation.
- Use Indonesian for all user-facing UI text, including menus, buttons, labels, empty states, alerts, validation messages, and dashboard text.
- Do not mix Indonesian into internal code naming.
- Do not show English UI labels to users unless it is a technical term that is commonly used.

Required Indonesian menu labels:

- Dasbor
- Pindai Struk
- Transaksi
- Anggaran
- Kategori
- Pengaturan

Common Indonesian UI labels:

- Masuk
- Daftar
- Keluar
- Simpan
- Hapus
- Ubah
- Batal
- Ekspor CSV
- Pindai Struk Baru
- Pengeluaran Bulan Ini
- Transaksi Terbaru
- Belum ada transaksi
- Unggah struk pertama Anda untuk mulai mencatat pengeluaran

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Tesseract.js
- Recharts

## MVP Constraints

- Web app only.
- No mobile app yet.
- No bank integration.
- No payment gateway.
- No paid OCR service.
- Use Tesseract.js for OCR.
- Use local file storage for MVP, but keep the storage abstraction replaceable later.
- OCR does not need to be perfect.
- Manual correction before saving is required.
- Prioritize extracting merchant, date, total amount, and category.
- Item-level parsing is optional and can be simple.

## Architecture Guidelines

- Keep the codebase modular and maintainable.
- Separate OCR logic from transaction logic.
- Separate parsing logic from OCR execution.
- Keep validation centralized where possible.
- Use reusable UI components.
- Avoid placing business logic directly inside UI components.
- Use server actions or API routes consistently; do not mix patterns without reason.
- Keep database access isolated through clear service or query functions.

Suggested folder structure:

```text
src/app
src/components
src/components/ui
src/features/auth
src/features/receipts
src/features/transactions
src/features/budgets
src/features/categories
src/features/dashboard
src/lib
src/lib/ocr
src/lib/parser
src/lib/validation
src/lib/storage
prisma
```

## Database Guidelines

- Use clear English model names.
- Suggested models:
  - User
  - Receipt
  - Transaction
  - TransactionItem
  - Category
  - Budget
- Store raw OCR text for debugging and future parser improvements.
- Store receipt image path or URL.
- Store parsed fields separately from raw OCR text.
- Always associate financial data with a user.

## OCR Guidelines

- Keep OCR processing in a dedicated module.
- Keep Indonesian receipt parsing in a dedicated parser module.
- Parser should handle common Indonesian receipt terms such as:
  - TOTAL
  - JUMLAH
  - GRAND TOTAL
  - TUNAI
  - KEMBALI
  - SUBTOTAL
  - PPN
  - PAJAK
- Parser should be defensive because OCR output may be messy.
- Always allow the user to edit parsed results before saving.

## Validation Rules

- Total transaction amount is required.
- Transaction date must be valid.
- Category is required.
- Merchant can be optional but should be suggested from OCR when possible.
- Amounts must be positive numbers.
- Budget amount must be a positive number.
- Show validation messages in Indonesian.

Required Indonesian validation messages:

- Total transaksi wajib diisi.
- Tanggal transaksi tidak valid.
- Kategori wajib dipilih.
- Nominal harus lebih dari 0.
- Gagal membaca struk. Coba unggah gambar yang lebih jelas.
- Gagal menyimpan transaksi. Silakan coba lagi.

## UI Guidelines

- Use a clean, modern, responsive layout.
- Prioritize clarity over visual complexity.
- Dashboard should show:
  - Pengeluaran Bulan Ini
  - Pengeluaran per Kategori
  - Transaksi Terbaru
  - Progress Anggaran
- Use charts only when they improve understanding.
- Empty states should be helpful and written in Indonesian.
- Buttons and actions should be obvious.

## Security And Privacy Guidelines

- Do not expose another user's transactions.
- Validate ownership before reading, editing, or deleting records.
- Do not store unnecessary sensitive data.
- Uploaded receipt images should be linked only to the authenticated user.
- Do not log private financial data unnecessarily.

## Development Workflow

1. Plan before implementing major changes.
2. Make small, focused commits or changes.
3. Keep features isolated by domain.
4. Update Prisma schema carefully and include migrations when needed.
5. Run linting and type checking after changes.
6. Do not introduce paid services or external dependencies without clear justification.
7. Prefer simple MVP solutions over complex abstractions.

## Feature Priority

1. Authentication
2. Receipt upload
3. OCR
4. OCR result review form
5. Save transaction
6. Transaction history
7. Categories
8. Budgets
9. Dashboard
10. CSV export
11. Parser improvements
12. Cloud storage integration later

## Do Not

- Do not build a mobile app for MVP.
- Do not integrate bank APIs.
- Do not add payment features.
- Do not use paid OCR APIs.
- Do not skip manual review after OCR.
- Do not hardcode user IDs.
- Do not use Indonesian names for variables, functions, models, or folders.
- Do not create overly complex architecture before the MVP works.

## When Unsure

- Prefer the simplest maintainable implementation.
- Keep user-facing text in Indonesian.
- Keep internal code in English.
- Preserve the MVP scope.

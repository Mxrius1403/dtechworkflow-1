const SHADE_MATRIX_URL = "https://shadeconverter.com";

export default function ShadeMatrixPage() {
  return (
    <iframe
      src={SHADE_MATRIX_URL}
      title="Shade Matrix"
      className="h-[calc(100vh-10rem)] min-h-[600px] w-full rounded-lg border bg-white"
      referrerPolicy="no-referrer"
      data-testid="shade-matrix-frame"
    />
  );
}

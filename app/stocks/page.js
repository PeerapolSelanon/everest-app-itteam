import Table from "../components/Table";
import CardLayout from "../components/CardLayout";

export default function stocks() {
  return (
    <main className="flex max-h-screen flex-col items-center justify-center px-5 lg:p-24">
      <h1
        className="my-10 text-center text-3xl font-bold uppercase 
tracking-widest"
      >
        Stocks
      </h1>
      <CardLayout>
        <Table></Table>
      </CardLayout>
    </main>
  );
}

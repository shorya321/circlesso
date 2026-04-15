import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MemberTableSkeletonProps {
  rows?: number;
}

export function MemberTableSkeleton({ rows = 5 }: MemberTableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div
                className="h-4 w-32 animate-pulse rounded bg-muted"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            </TableCell>
            <TableCell>
              <div
                className="h-4 w-48 animate-pulse rounded bg-muted"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            </TableCell>
            <TableCell>
              <div
                className="h-5 w-24 animate-pulse rounded-full bg-muted"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            </TableCell>
            <TableCell className="text-right">
              <div
                className="ml-auto h-8 w-20 animate-pulse rounded bg-muted"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

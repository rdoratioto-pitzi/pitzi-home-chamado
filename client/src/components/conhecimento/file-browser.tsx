import { Table, TableHeader, TableBody, TableRow, TableCell, Button } from "@/components/ui/table";
import { Folder, FileText, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

interface FileItem {
    type: 'folder' | 'file';
    name: string;
    description?: string;
    updatedAt: Date;
    path: string;
}

interface Breadcrumb {
    name: string;
    path: string;
}

interface FileBrowserProps {
    files: FileItem[];
    breadcrumbs: Breadcrumb[];
}

const FileBrowser: React.FC<FileBrowserProps> = ({ files, breadcrumbs }) => {
    const [currentPath, setCurrentPath] = useState("");
    const [, setLocation] = useLocation();
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'updatedAt'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const sortedFiles = [...files].sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        if (a.type === 'folder' && b.type === 'folder') {
            if (sortConfig.key === 'name') {
                return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            if (sortConfig.key === 'updatedAt') {
                return sortConfig.direction === 'asc' ? a.updatedAt.getTime() - b.updatedAt.getTime() : b.updatedAt.getTime() - a.updatedAt.getTime();
            }
        }
        if (a.type === 'file' && b.type === 'file') {
            if (sortConfig.key === 'name') {
                return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            if (sortConfig.key === 'updatedAt') {
                return sortConfig.direction === 'asc' ? a.updatedAt.getTime() - b.updatedAt.getTime() : b.updatedAt.getTime() - a.updatedAt.getTime();
            }
        }
        return 0;
    });

    const handleNavigate = (path: string) => {
        setLocation(path);
    };

    const requestSort = (key: 'name' | 'updatedAt') => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getIcon = (key: 'name' | 'updatedAt') => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'asc' ? <ChevronRight className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" style={{ transform: 'rotate(180deg)' }} />;
        }
        return null;
    };

    return (
        <div className="p-4">
            <nav aria-label="breadcrumb" className="mb-4">
                <ol className="flex items-center space-x-2">
                    {breadcrumbs.map((breadcrumb, index) => (
                        <li key={index} className="flex items-center">
                            <Button
                                variant="ghost"
                                onClick={() => handleNavigate(breadcrumb.path)}
                                className="flex items-center"
                            >
                                {breadcrumb.name}
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </li>
                    ))}
                </ol>
            </nav>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableCell onClick={() => requestSort('name')}>
                            Nome {getIcon('name')}
                        </TableCell>
                        <TableCell onClick={() => requestSort('updatedAt')}>
                            Última Modificação {getIcon('updatedAt')}
                        </TableCell>
                        <TableCell>Descrição</TableCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedFiles.map((file) => (
                        <TableRow
                            key={file.path}
                            className="cursor-pointer hover:bg-gray-100"
                            onClick={() => handleNavigate(file.path)}
                        >
                            <TableCell>
                                {file.type === 'folder' ? (
                                    <Folder className="inline h-4 w-4 mr-2" />
                                ) : (
                                    <FileText className="inline h-4 w-4 mr-2" />
                                )}
                                {file.name}
                            </TableCell>
                            <TableCell>
                                {file.updatedAt.toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                                {file.description || "Nenhuma descrição"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default FileBrowser;